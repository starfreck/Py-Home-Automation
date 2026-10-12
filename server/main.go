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

	"github.com/starfreck/omnihome-server/internal/hub"
	"github.com/starfreck/omnihome-server/internal/model"
	"github.com/starfreck/omnihome-server/internal/service"
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

	// Callback when an activity/audit log entry is generated
	onActivity := func(act *model.ActivityItem) {
		if eventHub != nil {
			eventHub.BroadcastJSON("activity_event", act)
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
					if err := deviceMgr.ApplyScene(id); err == nil {
						eventHub.BroadcastJSON("scene_activated", map[string]string{"id": id})
					}
				}
			}
		case "camera_scan":
			res := deviceMgr.PerformBiometricScan("CAM-01")
			eventHub.BroadcastJSON("camera_scan", res)
		case "clear_activity":
			deviceMgr.ClearActivities()
			eventHub.BroadcastJSON("activity_cleared", map[string]string{"status": "cleared"})
		}
	}

	eventHub = hub.NewHub(onClientMessage)
	go eventHub.Run()

	deviceMgr = service.NewDeviceManager(onDeviceUpdate, onActivity)

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
			"devices":    deviceMgr.GetAllDevices(),
			"telemetry":  deviceMgr.GetTelemetry(),
			"scenes":     deviceMgr.GetAllScenes(),
			"activities": deviceMgr.GetActivities(50),
			"snapshots":  deviceMgr.GetSnapshots(),
			"status":     deviceMgr.GetSystemStatus(),
		}
		eventHub.HandleWebSocket(w, r, initialState)
	})

	// REST API: Devices List & Creation
	mux.HandleFunc("/api/devices", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodPost {
			var newDev model.Device
			if err := json.NewDecoder(r.Body).Decode(&newDev); err != nil {
				http.Error(w, "invalid device payload", http.StatusBadRequest)
				return
			}
			created, err := deviceMgr.AddDevice(newDev)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			eventHub.BroadcastJSON("device_added", created)
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(created)
			return
		}
		json.NewEncoder(w).Encode(deviceMgr.GetAllDevices())
	})

	// REST API: Toggle, Update & Delete Device
	mux.HandleFunc("/api/devices/", func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) < 3 {
			http.NotFound(w, r)
			return
		}
		deviceID := parts[2]

		// DELETE /api/devices/{id}
		if r.Method == http.MethodDelete {
			if err := deviceMgr.DeleteDevice(deviceID); err != nil {
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}
			eventHub.BroadcastJSON("device_deleted", map[string]string{"id": deviceID})
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]string{"status": "deleted", "id": deviceID})
			return
		}

		// PUT /api/devices/{id} (Update metadata)
		if r.Method == http.MethodPut {
			var updatedDev model.Device
			if err := json.NewDecoder(r.Body).Decode(&updatedDev); err != nil {
				http.Error(w, "invalid payload", http.StatusBadRequest)
				return
			}
			res, err := deviceMgr.UpdateDevice(deviceID, updatedDev)
			if err != nil {
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(res)
			return
		}

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

	// REST API: System Settings
	mux.HandleFunc("/api/settings", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodPost {
			var s model.Settings
			if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
				http.Error(w, "invalid settings payload", http.StatusBadRequest)
				return
			}
			deviceMgr.UpdateSettings(s)
			json.NewEncoder(w).Encode(map[string]string{"status": "saved"})
			return
		}
		json.NewEncoder(w).Encode(deviceMgr.GetSettings())
	})

	// REST API: Telemetry
	mux.HandleFunc("/api/telemetry", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(deviceMgr.GetTelemetry())
	})

	// REST API: System Status & Node Health
	mux.HandleFunc("/api/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(deviceMgr.GetSystemStatus())
	})
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(deviceMgr.GetSystemStatus())
	})

	// REST API: Scenes List
	mux.HandleFunc("/api/scenes", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(deviceMgr.GetAllScenes())
	})

	// REST API: Scenes Activation
	mux.HandleFunc("/api/scenes/", func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) >= 4 && parts[3] == "activate" && r.Method == http.MethodPost {
			sceneID := parts[2]
			if err := deviceMgr.ApplyScene(sceneID); err != nil {
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}
			eventHub.BroadcastJSON("scene_activated", map[string]string{"id": sceneID})
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]string{"status": "activated", "id": sceneID})
			return
		}
		http.NotFound(w, r)
	})

	// REST API: Audit & Activity Ledger
	mux.HandleFunc("/api/activity", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodDelete {
			deviceMgr.ClearActivities()
			eventHub.BroadcastJSON("activity_cleared", map[string]string{"status": "cleared"})
			json.NewEncoder(w).Encode(map[string]string{"status": "cleared"})
			return
		}
		if r.Method == http.MethodPost {
			var body struct {
				Category string `json:"category"`
				Message  string `json:"message"`
				Source   string `json:"source"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err == nil && body.Message != "" {
				act := deviceMgr.LogActivity(body.Category, body.Message, body.Source)
				json.NewEncoder(w).Encode(act)
				return
			}
			http.Error(w, "invalid payload", http.StatusBadRequest)
			return
		}
		json.NewEncoder(w).Encode(deviceMgr.GetActivities(100))
	})

	// REST API: Camera & Biometric Intelligence
	mux.HandleFunc("/api/camera/scan", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		res := deviceMgr.PerformBiometricScan("CAM-01")
		eventHub.BroadcastJSON("camera_scan", res)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(res)
	})

	mux.HandleFunc("/api/camera/snapshot", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodPost {
			var snap model.CameraSnapshot
			if err := json.NewDecoder(r.Body).Decode(&snap); err != nil {
				http.Error(w, "invalid snapshot payload", http.StatusBadRequest)
				return
			}
			saved := deviceMgr.AddSnapshot(snap)
			eventHub.BroadcastJSON("camera_snapshot", saved)
			json.NewEncoder(w).Encode(saved)
			return
		}
		json.NewEncoder(w).Encode(deviceMgr.GetSnapshots())
	})

	mux.HandleFunc("/api/camera/snapshots", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(deviceMgr.GetSnapshots())
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
	fmt.Println("  ⚡ OmniHome Next-Gen Realtime IoT Gateway (Go 1.23+)")
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
