package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/starfreck/pyhome-server/internal/hub"
	"github.com/starfreck/pyhome-server/internal/model"
	"github.com/starfreck/pyhome-server/internal/service"
)

//go:embed web/*
var webFiles embed.FS

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// 1. Initialize Event Hub & Device Manager
	var eventHub *hub.Hub
	var deviceMgr *service.DeviceManager

	// Callback when a device updates (broadcast to all WebSockets)
	onDeviceUpdate := func(dev *model.Device) {
		if eventHub != nil {
			eventHub.BroadcastJSON("device_update", dev)
		}
	}

	// Callback when a WebSocket client sends an inbound action
	onClientMessage := func(msg model.WSMessage) {
		switch msg.Type {
		case "toggle":
			if payload, ok := msg.Payload.(map[string]interface{}); ok {
				if id, ok := payload["id"].(string); ok {
					deviceMgr.ToggleDevice(id)
				}
			}
		case "set_state":
			if payload, ok := msg.Payload.(map[string]interface{}); ok {
				id, _ := payload["id"].(string)
				state, _ := payload["state"].(bool)
				valFloat, _ := payload["value"].(float64)
				deviceMgr.SetDeviceState(id, state, int(valFloat))
			}
		case "scene":
			if payload, ok := msg.Payload.(map[string]interface{}); ok {
				if id, ok := payload["id"].(string); ok {
					deviceMgr.ApplyScene(id)
					eventHub.BroadcastJSON("event", fmt.Sprintf("Scene '%s' activated", id))
				}
			}
		}
	}

	eventHub = hub.NewHub(onClientMessage)
	go eventHub.Run()

	deviceMgr = service.NewDeviceManager(onDeviceUpdate)

	// Background ticker pushing live telemetry to all connected clients every 3 seconds
	go func() {
		ticker := time.NewTicker(3 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			telemetry := deviceMgr.GetTelemetry()
			eventHub.BroadcastJSON("telemetry", telemetry)
		}
	}()

	// 2. Setup HTTP Routes
	mux := http.NewServeMux()

	// WebSocket Endpoint
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		initialState := map[string]interface{}{
			"devices":   deviceMgr.GetAllDevices(),
			"telemetry": deviceMgr.GetTelemetry(),
		}
		eventHub.HandleWebSocket(w, r, initialState)
	})

	// REST API: Devices List
	mux.HandleFunc("/api/devices", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(deviceMgr.GetAllDevices())
	})

	// REST API: Toggle Device & Set State
	mux.HandleFunc("/api/devices/", func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		// Expecting: /api/devices/{id}/toggle or /api/devices/{id}/state
		if len(parts) < 3 {
			http.NotFound(w, r)
			return
		}
		deviceID := parts[2]

		if len(parts) >= 4 && parts[3] == "toggle" && r.Method == http.MethodPost {
			dev, err := deviceMgr.ToggleDevice(deviceID)
			if err != nil {
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(dev)
			return
		}

		if len(parts) >= 4 && parts[3] == "state" && r.Method == http.MethodPost {
			var body struct {
				State bool `json:"state"`
				Value int  `json:"value"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}
			dev, err := deviceMgr.SetDeviceState(deviceID, body.State, body.Value)
			if err != nil {
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(dev)
			return
		}

		http.NotFound(w, r)
	})

	// REST API: Telemetry
	mux.HandleFunc("/api/telemetry", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(deviceMgr.GetTelemetry())
	})

	// REST API: Scenes
	mux.HandleFunc("/api/scenes/", func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) >= 4 && parts[3] == "activate" && r.Method == http.MethodPost {
			sceneID := parts[2]
			if err := deviceMgr.ApplyScene(sceneID); err != nil {
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]string{"status": "activated"})
			return
		}
		http.NotFound(w, r)
	})

	// REST API: Voice Assistant (Gemma 4 integration)
	mux.HandleFunc("/api/voice", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req service.VoiceCommandRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		res := deviceMgr.ProcessVoiceCommand(req.Prompt)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(res)
	})

	// Embedded Static Web UI
	webSubFS, err := fs.Sub(webFiles, "web")
	if err != nil {
		log.Fatalf("Failed to initialize embedded web filesystem: %v", err)
	}
	fileServer := http.FileServer(http.FS(webSubFS))
	mux.Handle("/", fileServer)

	// 3. Print Startup Banner
	fmt.Println()
	fmt.Println("  ===============================================================")
	fmt.Println("  ⚡ PyHome Next-Gen Realtime IoT Gateway (Go 1.23+)")
	fmt.Println("  ===============================================================")
	fmt.Printf("   🌐 Web Dashboard:   http://localhost:%s\n", port)
	fmt.Printf("   📡 WebSocket Hub:   ws://localhost:%s/ws\n", port)
	fmt.Printf("   🔌 REST API:        http://localhost:%s/api/devices\n", port)
	fmt.Println("  ===============================================================")
	fmt.Println("   Ready! Open http://localhost:" + port + " in your browser.")
	fmt.Println()

	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
