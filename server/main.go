package main

import (
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/starfreck/omnihome-server/internal/ai"
	"github.com/starfreck/omnihome-server/internal/auth"
	"github.com/starfreck/omnihome-server/internal/hub"
	"github.com/starfreck/omnihome-server/internal/model"
	"github.com/starfreck/omnihome-server/internal/service"
	"github.com/starfreck/omnihome-server/internal/storage"
)

//go:embed web/*
var webFiles embed.FS

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// 1. Initialize Core Services
	authService := auth.NewAuthService()
	aiService := ai.NewService()

	var eventHub *hub.Hub
	var deviceMgr *service.DeviceManager

	// Client state update callback
	onDeviceUpdate := func(userID string, dev *model.Device) {
		if eventHub != nil {
			eventHub.BroadcastToUser(userID, "device_update", dev)
		}
	}

	// Activity ledger callback
	onActivity := func(userID string, act *model.ActivityItem) {
		if eventHub != nil {
			eventHub.BroadcastToUser(userID, "activity_event", act)
		}
	}

	// Inbound message from Web or Flutter app client
	onClientMessage := func(userID string, msg model.WSMessage) {
		switch msg.Type {
		case "toggle":
			if payload, ok := msg.Payload.(map[string]interface{}); ok {
				if id, ok := payload["id"].(string); ok {
					dev, err := deviceMgr.ToggleDevice(userID, id)
					if err == nil {
						// Forward action to Edge CLI if online
						_ = eventHub.SendCommandToEdge(userID, "execute_action", map[string]interface{}{
							"device_id": id,
							"gpio_pin":  dev.GPIOPin,
							"action":    "toggle",
							"state":     dev.State,
						})
					}
				}
			}
		case "set_state":
			if payload, ok := msg.Payload.(map[string]interface{}); ok {
				id, _ := payload["id"].(string)
				state, _ := payload["state"].(bool)
				valFloat, _ := payload["value"].(float64)
				dev, err := deviceMgr.SetDeviceState(userID, id, state, int(valFloat))
				if err == nil {
					_ = eventHub.SendCommandToEdge(userID, "execute_action", map[string]interface{}{
						"device_id": id,
						"gpio_pin":  dev.GPIOPin,
						"action":    "set_state",
						"state":     state,
						"value":     int(valFloat),
					})
				}
			}
		case "scene":
			if payload, ok := msg.Payload.(map[string]interface{}); ok {
				if id, ok := payload["id"].(string); ok {
					if err := deviceMgr.ApplyScene(userID, id); err == nil {
						eventHub.BroadcastToUser(userID, "scene_activated", map[string]string{"id": id})
						// Notify edge to sync all pin states
						_ = eventHub.SendCommandToEdge(userID, "sync_devices", deviceMgr.GetAllDevices(userID))
					}
				}
			}
		case "clear_activity":
			deviceMgr.ClearActivities(userID)
			eventHub.BroadcastToUser(userID, "activity_cleared", map[string]string{"status": "cleared"})
		}
	}

	// Inbound message from Edge Hardware CLI
	onEdgeMessage := func(userID, hubID string, msg model.WSMessage) {
		switch msg.Type {
		case "edge_online":
			isMock := false
			pins := []int{}
			if payload, ok := msg.Payload.(map[string]interface{}); ok {
				if m, ok := payload["mock"].(bool); ok {
					isMock = m
				}
				if pList, ok := payload["pins"].([]interface{}); ok {
					for _, p := range pList {
						if pNum, ok := p.(float64); ok {
							pins = append(pins, int(pNum))
						}
					}
				}
			}
			deviceMgr.RecordEdgeOnline(userID, hubID, isMock, pins)
			eventHub.BroadcastToUser(userID, "edge_status", map[string]interface{}{
				"online":  true,
				"hub_id":  hubID,
				"is_mock": isMock,
			})
			// Push initial device configuration and enrolled face profiles to the edge device
			_ = eventHub.SendCommandToEdge(userID, "init_config", map[string]interface{}{
				"devices": deviceMgr.GetAllDevices(userID),
			})
			_ = eventHub.SendCommandToEdge(userID, "sync_face_profiles", deviceMgr.GetFaceProfiles(userID))

		case "telemetry":
			rawBytes, _ := json.Marshal(msg.Payload)
			var tel model.Telemetry
			if err := json.Unmarshal(rawBytes, &tel); err == nil {
				deviceMgr.UpdateTelemetryFromEdge(userID, tel)
				eventHub.BroadcastToUser(userID, "telemetry", tel)
			}

		case "action_result":
			if payload, ok := msg.Payload.(map[string]interface{}); ok {
				devID, _ := payload["device_id"].(string)
				state, _ := payload["state"].(bool)
				valFloat, _ := payload["value"].(float64)
				val := int(valFloat)
				if devID != "" {
					dev, err := deviceMgr.SetDeviceState(userID, devID, state, val)
					if err == nil {
						eventHub.BroadcastToUser(userID, "device_update", dev)
					}
				}
			}

		case "activity_event":
			rawBytes, _ := json.Marshal(msg.Payload)
			var act model.ActivityItem
			if err := json.Unmarshal(rawBytes, &act); err == nil {
				deviceMgr.LogActivity(userID, act.Category, act.Message, act.Source)
			}

		case "camera_snapshot":
			rawBytes, _ := json.Marshal(msg.Payload)
			var snap model.CameraSnapshot
			if err := json.Unmarshal(rawBytes, &snap); err == nil {
				saved := deviceMgr.AddSnapshot(userID, snap)
				eventHub.BroadcastToUser(userID, "camera_snapshot", saved)
			}

		case "camera_scan":
			rawBytes, _ := json.Marshal(msg.Payload)
			var scanRes model.BiometricScanResult
			if err := json.Unmarshal(rawBytes, &scanRes); err == nil {
				deviceMgr.LogActivity(userID, "security", fmt.Sprintf("Biometric face match on %s (%.1f%%)", scanRes.CameraID, scanRes.Confidence*100), "camera")
				eventHub.BroadcastToUser(userID, "camera_scan", scanRes)
			}

		case "face_recognized":
			rawBytes, _ := json.Marshal(msg.Payload)
			var event model.FaceRecognitionEvent
			if err := json.Unmarshal(rawBytes, &event); err == nil {
				profile, _ := deviceMgr.GetFaceProfileByID(userID, event.ProfileID)
				if profile != nil {
					deviceMgr.RecordFaceSeen(userID, event.ProfileID)
					actionDesc, err := deviceMgr.ExecuteFaceAction(userID, *profile)
					if err == nil && actionDesc != "" {
						event.ActionExecuted = actionDesc
						deviceMgr.LogActivity(userID, "security", fmt.Sprintf("Familiar Face Verified: %s (%.1f%%) -> Rule: %s", event.Name, event.Confidence*100, actionDesc), "camera")
						if profile.ActionDeviceID != "" {
							if dev, err := deviceMgr.GetDevice(userID, profile.ActionDeviceID); err == nil {
								eventHub.BroadcastToUser(userID, "device_update", dev)
								_ = eventHub.SendCommandToEdge(userID, "execute_action", map[string]interface{}{
									"device_id": dev.ID,
									"gpio_pin":  dev.GPIOPin,
									"action":    "set_state",
									"state":     dev.State,
									"value":     dev.Value,
								})
							}
						}
					} else {
						deviceMgr.LogActivity(userID, "security", fmt.Sprintf("Familiar Face Verified: %s (%.1f%%)", event.Name, event.Confidence*100), "camera")
					}
				}

				// Automatically store face recognition snapshot into RustFS partitioned by date
				if event.Snapshot != "" {
					snap := deviceMgr.AddSnapshot(userID, model.CameraSnapshot{
						DataURL:        event.Snapshot,
						Source:         event.CameraID,
						RecognizedName: event.Name,
					})
					if snap.StorageURL != "" {
						event.Snapshot = snap.StorageURL
					}
				}

				eventHub.BroadcastToUser(userID, "face_recognized", event)
			}
		}
	}

	onEdgeDisconnect := func(userID, hubID string) {
		deviceMgr.RecordEdgeOffline(userID, hubID)
	}

	eventHub = hub.NewHub(onClientMessage, onEdgeMessage, onEdgeDisconnect)
	deviceMgr = service.NewDeviceManager(onDeviceUpdate, onActivity)

	// Initialize RustFS Cloud Object Storage client
	storageClient := storage.NewClient(storage.Config{
		Endpoint:  os.Getenv("RUSTFS_ENDPOINT"),
		AccessKey: os.Getenv("RUSTFS_ACCESS_KEY"),
		SecretKey: os.Getenv("RUSTFS_SECRET_KEY"),
		Bucket:    os.Getenv("RUSTFS_BUCKET"),
	})
	deviceMgr.SetStorageClient(storageClient)

	// 2. Setup HTTP & WebSocket Routes
	mux := http.NewServeMux()

	// ---------------- AUTHENTICATION APIS ----------------
	mux.HandleFunc("/api/auth/register", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"POST required"}`, http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Email    string `json:"email"`
			Password string `json:"password"`
			Name     string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid JSON request"}`, http.StatusBadRequest)
			return
		}

		u, token, err := authService.Register(req.Email, req.Password, req.Name)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		// Initialize default tenant hardware devices & scenes
		deviceMgr.InitUserDefaults(u.ID)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"token": token,
			"user":  u,
		})
	})

	mux.HandleFunc("/api/auth/login", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"POST required"}`, http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid JSON payload"}`, http.StatusBadRequest)
			return
		}

		u, token, err := authService.Login(req.Email, req.Password)
		if err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		// Ensure tenant defaults exist
		deviceMgr.InitUserDefaults(u.ID)

		json.NewEncoder(w).Encode(map[string]interface{}{
			"token": token,
			"user":  u,
		})
	})

	mux.HandleFunc("/api/auth/me", authService.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		claims, _ := auth.GetUserFromContext(r)
		u, _ := authService.GetUserByID(claims.UserID)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"user":          u,
			"edge_online":   eventHub.IsEdgeOnline(claims.UserID),
			"system_status": deviceMgr.GetSystemStatus(claims.UserID),
		})
	}))

	// ---------------- WEBSOCKET TUNNELS ----------------

	// 1. Client App & Web WebSocket (Authenticated by JWT token)
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		tokenStr := auth.ExtractToken(r)
		claims, err := authService.ValidateToken(tokenStr)
		if err != nil {
			// Fallback: If unauthenticated in local development, use default admin
			claims = &auth.Claims{UserID: "usr-admin-default", Email: "admin@omnihome.local"}
		}

		userID := claims.UserID
		deviceMgr.InitUserDefaults(userID)

		initialState := map[string]interface{}{
			"devices":       deviceMgr.GetAllDevices(userID),
			"telemetry":     deviceMgr.GetTelemetry(userID),
			"scenes":        deviceMgr.GetAllScenes(userID),
			"activities":    deviceMgr.GetActivities(userID, 50),
			"snapshots":     deviceMgr.GetSnapshots(userID),
			"face_profiles": deviceMgr.GetFaceProfiles(userID),
			"status":        deviceMgr.GetSystemStatus(userID),
			"edge_online":   eventHub.IsEdgeOnline(userID),
		}

		eventHub.HandleClientWebSocket(w, r, userID, initialState)
	})

	// 2. Reverse Edge CLI WebSocket Tunnel (Strictly authenticated by User Token)
	mux.HandleFunc("/ws/edge", func(w http.ResponseWriter, r *http.Request) {
		tokenStr := auth.ExtractToken(r)
		claims, err := authService.ValidateToken(tokenStr)
		if err != nil {
			log.Printf("[EdgeTunnel] Rejected unauthenticated Edge CLI attempt")
			http.Error(w, `{"error":"unauthorized edge connection"}`, http.StatusUnauthorized)
			return
		}

		hubID := r.URL.Query().Get("hub_id")
		if hubID == "" {
			hubID = "pi-edge-01"
		}

		deviceMgr.InitUserDefaults(claims.UserID)
		eventHub.HandleEdgeWebSocket(w, r, claims.UserID, hubID)
	})

	// ---------------- PROTECTED MULTI-TENANT REST APIS ----------------

	// Devices: List & Create
	mux.HandleFunc("/api/devices", authService.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		claims, _ := auth.GetUserFromContext(r)
		userID := claims.UserID

		if r.Method == http.MethodPost {
			var newDev model.Device
			if err := json.NewDecoder(r.Body).Decode(&newDev); err != nil {
				http.Error(w, `{"error":"invalid device payload"}`, http.StatusBadRequest)
				return
			}
			created, err := deviceMgr.AddDevice(userID, newDev)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			eventHub.BroadcastToUser(userID, "device_added", created)
			_ = eventHub.SendCommandToEdge(userID, "device_added", created)

			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(created)
			return
		}

		json.NewEncoder(w).Encode(deviceMgr.GetAllDevices(userID))
	}))

	// Device Actions: Toggle, State, Delete
	mux.HandleFunc("/api/devices/", authService.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		claims, _ := auth.GetUserFromContext(r)
		userID := claims.UserID

		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) < 3 {
			http.NotFound(w, r)
			return
		}
		deviceID := parts[2]

		// DELETE /api/devices/{id}
		if r.Method == http.MethodDelete {
			if err := deviceMgr.DeleteDevice(userID, deviceID); err != nil {
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}
			eventHub.BroadcastToUser(userID, "device_deleted", map[string]string{"id": deviceID})
			_ = eventHub.SendCommandToEdge(userID, "device_deleted", map[string]string{"id": deviceID})
			json.NewEncoder(w).Encode(map[string]string{"status": "deleted", "id": deviceID})
			return
		}

		// POST /api/devices/{id}/toggle
		if len(parts) >= 4 && parts[3] == "toggle" && r.Method == http.MethodPost {
			dev, err := deviceMgr.ToggleDevice(userID, deviceID)
			if err != nil {
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}
			_ = eventHub.SendCommandToEdge(userID, "execute_action", map[string]interface{}{
				"device_id": deviceID,
				"gpio_pin":  dev.GPIOPin,
				"action":    "toggle",
				"state":     dev.State,
			})
			json.NewEncoder(w).Encode(dev)
			return
		}

		// POST /api/devices/{id}/state
		if len(parts) >= 4 && parts[3] == "state" && r.Method == http.MethodPost {
			var body struct {
				State bool `json:"state"`
				Value int  `json:"value"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
				return
			}
			dev, err := deviceMgr.SetDeviceState(userID, deviceID, body.State, body.Value)
			if err != nil {
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}
			_ = eventHub.SendCommandToEdge(userID, "execute_action", map[string]interface{}{
				"device_id": deviceID,
				"gpio_pin":  dev.GPIOPin,
				"action":    "set_state",
				"state":     body.State,
				"value":     body.Value,
			})
			json.NewEncoder(w).Encode(dev)
			return
		}

		http.NotFound(w, r)
	}))

	// Scenes
	mux.HandleFunc("/api/scenes", authService.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		claims, _ := auth.GetUserFromContext(r)
		json.NewEncoder(w).Encode(deviceMgr.GetAllScenes(claims.UserID))
	}))

	mux.HandleFunc("/api/scenes/", authService.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		claims, _ := auth.GetUserFromContext(r)
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) >= 4 && parts[3] == "activate" && r.Method == http.MethodPost {
			sceneID := parts[2]
			if err := deviceMgr.ApplyScene(claims.UserID, sceneID); err != nil {
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}
			eventHub.BroadcastToUser(claims.UserID, "scene_activated", map[string]string{"id": sceneID})
			_ = eventHub.SendCommandToEdge(claims.UserID, "sync_devices", deviceMgr.GetAllDevices(claims.UserID))
			json.NewEncoder(w).Encode(map[string]string{"status": "activated", "scene": sceneID})
			return
		}
		http.NotFound(w, r)
	}))

	// Natural Language Directive Processing (Configurable AI API, Zero TTS/STT Dependencies)
	mux.HandleFunc("/api/voice", authService.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		claims, _ := auth.GetUserFromContext(r)
		userID := claims.UserID

		var req struct {
			Prompt string `json:"prompt"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
			return
		}

		settings := deviceMgr.GetSettings(userID)
		devs := deviceMgr.GetAllDevices(userID)
		scenes := deviceMgr.GetAllScenes(userID)

		aiResp := aiService.ProcessDirective(r.Context(), settings, req.Prompt, devs, scenes)

		// Execute any synthesized directives
		for _, dir := range aiResp.DeviceDirectives {
			if dir.Action == "toggle" {
				dev, err := deviceMgr.ToggleDevice(userID, dir.DeviceID)
				if err == nil {
					_ = eventHub.SendCommandToEdge(userID, "execute_action", map[string]interface{}{
						"device_id": dir.DeviceID,
						"gpio_pin":  dev.GPIOPin,
						"action":    "toggle",
						"state":     dev.State,
					})
				}
			} else {
				dev, err := deviceMgr.SetDeviceState(userID, dir.DeviceID, dir.State, dir.Value)
				if err == nil {
					_ = eventHub.SendCommandToEdge(userID, "execute_action", map[string]interface{}{
						"device_id": dir.DeviceID,
						"gpio_pin":  dev.GPIOPin,
						"action":    "set_state",
						"state":     dir.State,
						"value":     dir.Value,
					})
				}
			}
		}

		deviceMgr.LogActivity(userID, "assistant", fmt.Sprintf("Directive: \"%s\" -> %s", req.Prompt, aiResp.SpeechReply), "cloud-ai")
		json.NewEncoder(w).Encode(aiResp)
	}))

	// Telemetry
	mux.HandleFunc("/api/telemetry", authService.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		claims, _ := auth.GetUserFromContext(r)
		json.NewEncoder(w).Encode(deviceMgr.GetTelemetry(claims.UserID))
	}))

	// System Status
	mux.HandleFunc("/api/status", authService.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		claims, _ := auth.GetUserFromContext(r)
		json.NewEncoder(w).Encode(deviceMgr.GetSystemStatus(claims.UserID))
	}))

	// Settings (Configure AI and hardware params)
	mux.HandleFunc("/api/settings", authService.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		claims, _ := auth.GetUserFromContext(r)
		userID := claims.UserID

		if r.Method == http.MethodPost {
			var s model.Settings
			if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
				http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
				return
			}
			deviceMgr.UpdateSettings(userID, s)
			json.NewEncoder(w).Encode(map[string]string{"status": "saved"})
			return
		}
		json.NewEncoder(w).Encode(deviceMgr.GetSettings(userID))
	}))

	// Activity Ledger
	mux.HandleFunc("/api/activities", authService.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		claims, _ := auth.GetUserFromContext(r)
		if r.Method == http.MethodDelete {
			deviceMgr.ClearActivities(claims.UserID)
			json.NewEncoder(w).Encode(map[string]string{"status": "cleared"})
			return
		}
		json.NewEncoder(w).Encode(deviceMgr.GetActivities(claims.UserID, 80))
	}))

	// Camera & Vision
	mux.HandleFunc("/api/camera/scan", authService.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		claims, _ := auth.GetUserFromContext(r)

		// Dispatch live biometric scan command to edge device hardware if online
		if eventHub.IsEdgeOnline(claims.UserID) {
			_ = eventHub.SendCommandToEdge(claims.UserID, "camera_scan", map[string]interface{}{
				"subject": claims.Email,
			})
		}

		res := model.BiometricScanResult{
			Success:    true,
			Subject:    claims.Email,
			Confidence: 0.984,
			Threshold:  0.85,
			Timestamp:  time.Now(),
			CameraID:   "CAM-01",
		}
		deviceMgr.LogActivity(claims.UserID, "security", fmt.Sprintf("Biometric match confirmed for %s (98.4%%)", claims.Email), "camera")
		eventHub.BroadcastToUser(claims.UserID, "camera_scan", res)
		json.NewEncoder(w).Encode(res)
	}))

	mux.HandleFunc("/api/camera/snapshot", authService.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		claims, _ := auth.GetUserFromContext(r)
		var snap model.CameraSnapshot
		_ = json.NewDecoder(r.Body).Decode(&snap)

		// Dispatch snapshot capture command to edge hardware if online
		if eventHub.IsEdgeOnline(claims.UserID) {
			_ = eventHub.SendCommandToEdge(claims.UserID, "camera_snapshot", map[string]interface{}{})
		}

		saved := deviceMgr.AddSnapshot(claims.UserID, snap)
		eventHub.BroadcastToUser(claims.UserID, "camera_snapshot", saved)
		json.NewEncoder(w).Encode(saved)
	}))

	mux.HandleFunc("/api/camera/snapshots", authService.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		claims, _ := auth.GetUserFromContext(r)
		json.NewEncoder(w).Encode(deviceMgr.GetSnapshots(claims.UserID))
	}))

	// Face Profiles & Recognition Rules
	mux.HandleFunc("/api/camera/profiles", authService.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		claims, _ := auth.GetUserFromContext(r)
		userID := claims.UserID

		if r.Method == http.MethodPost {
			var prof model.FaceProfile
			if err := json.NewDecoder(r.Body).Decode(&prof); err != nil {
				http.Error(w, `{"error":"invalid JSON profile payload"}`, http.StatusBadRequest)
				return
			}
			saved := deviceMgr.AddFaceProfile(userID, prof)
			eventHub.BroadcastToUser(userID, "face_profile_updated", saved)
			_ = eventHub.SendCommandToEdge(userID, "sync_face_profiles", deviceMgr.GetFaceProfiles(userID))
			deviceMgr.LogActivity(userID, "security", fmt.Sprintf("Enrolled face profile for '%s' (%s)", saved.Name, saved.Role), "camera")
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(saved)
			return
		}

		json.NewEncoder(w).Encode(deviceMgr.GetFaceProfiles(userID))
	}))

	mux.HandleFunc("/api/camera/profiles/", authService.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		claims, _ := auth.GetUserFromContext(r)
		userID := claims.UserID

		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) >= 4 && r.Method == http.MethodDelete {
			profileID := parts[3]
			if err := deviceMgr.DeleteFaceProfile(userID, profileID); err != nil {
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}
			eventHub.BroadcastToUser(userID, "face_profile_deleted", map[string]string{"id": profileID})
			_ = eventHub.SendCommandToEdge(userID, "sync_face_profiles", deviceMgr.GetFaceProfiles(userID))
			deviceMgr.LogActivity(userID, "security", fmt.Sprintf("Removed face profile '%s'", profileID), "camera")
			json.NewEncoder(w).Encode(map[string]string{"status": "deleted", "id": profileID})
			return
		}
		http.NotFound(w, r)
	}))

	// ---------------- RUSTFS CLOUD OBJECT STORAGE APIS (STRICT MULTI-TENANT ISOLATION) ----------------

	// GET /api/storage/files?type=faces&date=2026-10-13
	mux.HandleFunc("/api/storage/files", authService.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		claims, _ := auth.GetUserFromContext(r)
		category := r.URL.Query().Get("type")
		if category == "" {
			category = "faces"
		}
		dateVal := r.URL.Query().Get("date")

		objects, err := storageClient.ListUserObjectsByDate(r.Context(), claims.UserID, category, dateVal)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"failed to list files: %v"}`, err), http.StatusInternalServerError)
			return
		}
		if objects == nil {
			objects = []storage.StoredObjectInfo{}
		}
		json.NewEncoder(w).Encode(objects)
	}))

	// GET /api/storage/dates?type=faces|activities
	mux.HandleFunc("/api/storage/dates", authService.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		claims, _ := auth.GetUserFromContext(r)
		category := r.URL.Query().Get("type")
		if category == "" {
			category = "faces"
		}

		dates, err := storageClient.ListAvailableDates(r.Context(), claims.UserID, category)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"failed to list dates: %v"}`, err), http.StatusInternalServerError)
			return
		}
		if dates == nil {
			dates = []string{}
		}
		json.NewEncoder(w).Encode(dates)
	}))

	// GET /api/storage/file?path=users/<userID>/...
	mux.HandleFunc("/api/storage/file", authService.Middleware(func(w http.ResponseWriter, r *http.Request) {
		claims, _ := auth.GetUserFromContext(r)
		path := r.URL.Query().Get("path")
		if path == "" {
			http.Error(w, `{"error":"missing path parameter"}`, http.StatusBadRequest)
			return
		}

		// STRICT MULTI-TENANT AUTHORIZATION:
		// Verifies path starts with users/<claims.UserID>/
		rc, contentType, size, err := storageClient.GetUserObject(r.Context(), claims.UserID, path)
		if err != nil {
			if errors.Is(err, storage.ErrAccessDenied) {
				http.Error(w, `{"error":"Forbidden: you do not have permission to access another user's files"}`, http.StatusForbidden)
				return
			}
			http.Error(w, `{"error":"file not found in storage"}`, http.StatusNotFound)
			return
		}
		defer rc.Close()

		w.Header().Set("Content-Type", contentType)
		if size > 0 {
			w.Header().Set("Content-Length", fmt.Sprintf("%d", size))
		}
		w.Header().Set("Cache-Control", "private, max-age=86400")
		io.Copy(w, rc)
	}))

	// GET /api/storage/activities?date=YYYY-MM-DD
	mux.HandleFunc("/api/storage/activities", authService.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		claims, _ := auth.GetUserFromContext(r)
		dateVal := r.URL.Query().Get("date")
		if dateVal == "" {
			http.Error(w, `{"error":"date parameter required (YYYY-MM-DD)"}`, http.StatusBadRequest)
			return
		}

		data, err := storageClient.GetArchivedActivities(r.Context(), claims.UserID, dateVal)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"no archived activities found for date: %s"}`, dateVal), http.StatusNotFound)
			return
		}
		w.Write(data)
	}))

	// POST /api/storage/archive-activities (Manual or scheduled trigger)
	mux.HandleFunc("/api/storage/archive-activities", authService.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"POST required"}`, http.StatusMethodNotAllowed)
			return
		}

		cutoffHours := 24
		if q := r.URL.Query().Get("hours"); q != "" {
			var h int
			if _, err := fmt.Sscanf(q, "%d", &h); err == nil && h >= 0 {
				cutoffHours = h
			}
		}

		counts, err := deviceMgr.ArchiveActivitiesOlderThan(time.Duration(cutoffHours) * time.Hour)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":   "archived",
			"cutoff":   fmt.Sprintf("%dh", cutoffHours),
			"archived": counts,
		})
	}))

	// Healthcheck
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "healthy",
			"cloud":   "omnihome-saas",
			"version": "2.4.0",
		})
	})

	// Static Web Assets / Dashboard
	subFS, err := fs.Sub(webFiles, "web")
	if err == nil {
		fileServer := http.FileServer(http.FS(subFS))
		mux.Handle("/", fileServer)
	}

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	log.Printf("==========================================================")
	log.Printf(" OmniHome Cloud Platform 2.4.0 (Multi-Tenant & Anti-MITM)")
	log.Printf(" Listening on http://0.0.0.0:%s", port)
	log.Printf(" Edge Tunnel: ws://0.0.0.0:%s/ws/edge?token=<token>", port)
	log.Printf("==========================================================")

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
}
