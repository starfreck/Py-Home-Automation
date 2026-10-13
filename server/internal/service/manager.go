package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/rand"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/starfreck/omnihome-server/internal/model"
	"github.com/starfreck/omnihome-server/internal/storage"
)

// DeviceManager coordinates multi-tenant device states, edge hardware channels, and telemetry.
type DeviceManager struct {
	// UserID -> DeviceID -> Device
	devices map[string]map[string]*model.Device

	// UserID -> SceneID -> Scene
	scenes map[string]map[string]model.Scene

	// UserID -> Telemetry
	telemetry map[string]model.Telemetry

	// UserID -> Settings
	settings map[string]model.Settings

	// UserID -> []ActivityItem
	activities map[string][]model.ActivityItem

	// UserID -> []CameraSnapshot
	snapshots map[string][]model.CameraSnapshot

	// UserID -> ProfileID -> FaceProfile
	faceProfiles map[string]map[string]model.FaceProfile

	// UserID -> HubNode
	hubNodes map[string]*model.HubNode

	storageClient *storage.Client
	startTime     time.Time
	mu            sync.RWMutex
	onUpdate      func(userID string, device *model.Device)
	onActivity    func(userID string, item *model.ActivityItem)
	stopChan      chan struct{}
}

// NewDeviceManager initializes the multi-tenant manager.
func NewDeviceManager(
	onUpdate func(userID string, device *model.Device),
	onActivity func(userID string, item *model.ActivityItem),
) *DeviceManager {
	dm := &DeviceManager{
		devices:      make(map[string]map[string]*model.Device),
		scenes:       make(map[string]map[string]model.Scene),
		telemetry:    make(map[string]model.Telemetry),
		settings:     make(map[string]model.Settings),
		activities:   make(map[string][]model.ActivityItem),
		snapshots:    make(map[string][]model.CameraSnapshot),
		faceProfiles: make(map[string]map[string]model.FaceProfile),
		hubNodes:     make(map[string]*model.HubNode),
		startTime:    time.Now(),
		onUpdate:     onUpdate,
		onActivity:   onActivity,
		stopChan:     make(chan struct{}),
	}

	// Seed default administrator tenant
	dm.InitUserDefaults("usr-admin-default")

	go dm.telemetryWorker()
	go dm.activityArchiveWorker()
	return dm
}

// SetStorageClient assigns the RustFS object storage client.
func (dm *DeviceManager) SetStorageClient(sc *storage.Client) {
	dm.mu.Lock()
	defer dm.mu.Unlock()
	dm.storageClient = sc
}

// GetStorageClient returns the configured storage client.
func (dm *DeviceManager) GetStorageClient() *storage.Client {
	dm.mu.RLock()
	defer dm.mu.RUnlock()
	return dm.storageClient
}

// InitUserDefaults populates initial sample devices and presets for a new tenant.
func (dm *DeviceManager) InitUserDefaults(userID string) {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	if _, exists := dm.devices[userID]; exists {
		return
	}

	dm.devices[userID] = make(map[string]*model.Device)
	dm.scenes[userID] = make(map[string]model.Scene)
	dm.activities[userID] = make([]model.ActivityItem, 0)
	dm.snapshots[userID] = make([]model.CameraSnapshot, 0)
	dm.settings[userID] = model.Settings{
		HubName:            "OmniHome Edge Controller",
		AIProvider:         "local",
		CameraSource:       "CSI Camera 01 (/dev/video0)",
		BiometricThreshold: 0.85,
		TelemetryInterval:  4,
	}

	now := time.Now()
	defaults := []*model.Device{
		{
			ID:          "device-1",
			UserID:      userID,
			Name:        "Living Room Light",
			Type:        model.TypeRelay,
			Room:        "Living Room",
			State:       true,
			Value:       100,
			GPIOPin:     17,
			PowerWatts:  45.0,
			Icon:        "💡",
			LastUpdated: now,
		},
		{
			ID:          "device-2",
			UserID:      userID,
			Name:        "Ceiling Fan",
			Type:        model.TypeFan,
			Room:        "Living Room",
			State:       true,
			Value:       60,
			GPIOPin:     27,
			PowerWatts:  55.0,
			Icon:        "🌀",
			LastUpdated: now,
		},
		{
			ID:          "device-3",
			UserID:      userID,
			Name:        "Smart Television",
			Type:        model.TypeRelay,
			Room:        "Living Room",
			State:       false,
			Value:       0,
			GPIOPin:     22,
			PowerWatts:  120.0,
			Icon:        "📺",
			LastUpdated: now,
		},
		{
			ID:          "device-4",
			UserID:      userID,
			Name:        "Air Conditioner",
			Type:        model.TypeRelay,
			Room:        "Bedroom",
			State:       false,
			Value:       0,
			GPIOPin:     23,
			PowerWatts:  850.0,
			Icon:        "❄️",
			LastUpdated: now,
		},
		{
			ID:          "device-5",
			UserID:      userID,
			Name:        "Ambient Accent Strip",
			Type:        model.TypeDimmer,
			Room:        "Living Room",
			State:       true,
			Value:       75,
			GPIOPin:     24,
			PowerWatts:  14.0,
			Icon:        "🌈",
			LastUpdated: now,
		},
		{
			ID:          "device-6",
			UserID:      userID,
			Name:        "Front Door Lock",
			Type:        model.TypeLock,
			Room:        "Security",
			State:       true, // Locked
			Value:       100,
			GPIOPin:     25,
			PowerWatts:  2.5,
			Icon:        "🔒",
			LastUpdated: now,
		},
	}

	for _, d := range defaults {
		dm.devices[userID][d.ID] = d
	}

	dm.scenes[userID]["all_on"] = model.Scene{
		ID:          "all_on",
		UserID:      userID,
		Name:        "All On",
		Icon:        "☀️",
		Description: "Turn on all lights and climate",
		Actions: map[string]bool{
			"device-1": true,
			"device-2": true,
			"device-3": true,
			"device-4": true,
			"device-5": true,
		},
	}

	dm.scenes[userID]["all_off"] = model.Scene{
		ID:          "all_off",
		UserID:      userID,
		Name:        "All Off",
		Icon:        "🌙",
		Description: "Turn off all active appliances",
		Actions: map[string]bool{
			"device-1": false,
			"device-2": false,
			"device-3": false,
			"device-4": false,
			"device-5": false,
		},
	}

	dm.scenes[userID]["movie_night"] = model.Scene{
		ID:          "movie_night",
		UserID:      userID,
		Name:        "Cinema Mode",
		Icon:        "🎬",
		Description: "Dim lights, activate TV and ambient strip",
		Actions: map[string]bool{
			"device-1": false,
			"device-2": true,
			"device-3": true,
			"device-4": false,
			"device-5": true,
		},
	}

	dm.scenes[userID]["secure_perimeter"] = model.Scene{
		ID:          "secure_perimeter",
		UserID:      userID,
		Name:        "Secure Perimeter",
		Icon:        "🛡️",
		Description: "Lock front deadbolt and arm perimeter cameras",
		Actions: map[string]bool{
			"device-1": false,
			"device-3": false,
			"device-6": true,
		},
	}

	dm.telemetry[userID] = model.Telemetry{
		UserID:      userID,
		Temperature: 22.4,
		Humidity:    48.0,
		TotalWatts:  181.5,
		CPUUsage:    4.8,
		MemoryUsage: 22.5,
		CPUTemp:     38.5,
		ActiveCount: 4,
		TotalCount:  6,
		Timestamp:   time.Now(),
	}

	dm.activities[userID] = append(dm.activities[userID], model.ActivityItem{
		ID:        fmt.Sprintf("act-%d", time.Now().UnixNano()),
		UserID:    userID,
		Timestamp: time.Now(),
		Category:  "system",
		Message:   "Cloud tenant initialized. Awaiting Edge CLI connection.",
		Source:    "cloud",
	})

	if _, ok := dm.faceProfiles[userID]; !ok {
		dm.faceProfiles[userID] = make(map[string]model.FaceProfile)
	}
}

// GetAllDevices returns all devices belonging to a user.
func (dm *DeviceManager) GetAllDevices(userID string) []*model.Device {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	userDevs, ok := dm.devices[userID]
	if !ok {
		return []*model.Device{}
	}

	list := make([]*model.Device, 0, len(userDevs))
	for _, d := range userDevs {
		cpy := *d
		list = append(list, &cpy)
	}

	sort.Slice(list, func(i, j int) bool {
		return list[i].ID < list[j].ID
	})
	return list
}

// GetDevice retrieves a device ensuring ownership.
func (dm *DeviceManager) GetDevice(userID, deviceID string) (*model.Device, error) {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	userDevs, ok := dm.devices[userID]
	if !ok {
		return nil, fmt.Errorf("device not found")
	}

	d, ok := userDevs[deviceID]
	if !ok {
		return nil, fmt.Errorf("device not found")
	}

	cpy := *d
	return &cpy, nil
}

// ToggleDevice flips a device state.
func (dm *DeviceManager) ToggleDevice(userID, deviceID string) (*model.Device, error) {
	dm.mu.Lock()
	userDevs, ok := dm.devices[userID]
	if !ok {
		dm.mu.Unlock()
		return nil, fmt.Errorf("device not found")
	}

	d, ok := userDevs[deviceID]
	if !ok {
		dm.mu.Unlock()
		return nil, fmt.Errorf("device not found")
	}

	d.State = !d.State
	d.LastUpdated = time.Now()
	cpy := *d
	dm.mu.Unlock()

	action := "turned ON"
	if !cpy.State {
		action = "turned OFF"
	}
	if cpy.Type == model.TypeLock {
		if cpy.State {
			action = "locked (secured)"
		} else {
			action = "unlocked"
		}
	}

	dm.LogActivity(userID, "hardware", fmt.Sprintf("%s %s", cpy.Name, action), "cloud")

	if dm.onUpdate != nil {
		dm.onUpdate(userID, &cpy)
	}

	return &cpy, nil
}

// SetDeviceState sets a specific state and optional slider value.
func (dm *DeviceManager) SetDeviceState(userID, deviceID string, state bool, val int) (*model.Device, error) {
	dm.mu.Lock()
	userDevs, ok := dm.devices[userID]
	if !ok {
		dm.mu.Unlock()
		return nil, fmt.Errorf("device not found")
	}

	d, ok := userDevs[deviceID]
	if !ok {
		dm.mu.Unlock()
		return nil, fmt.Errorf("device not found")
	}

	d.State = state
	if val >= 0 {
		d.Value = val
	}
	d.LastUpdated = time.Now()
	cpy := *d
	dm.mu.Unlock()

	if val >= 0 {
		dm.LogActivity(userID, "hardware", fmt.Sprintf("%s adjusted to %d%% (%v)", cpy.Name, cpy.Value, cpy.State), "cloud")
	} else {
		action := "turned ON"
		if !cpy.State {
			action = "turned OFF"
		}
		dm.LogActivity(userID, "hardware", fmt.Sprintf("%s %s", cpy.Name, action), "cloud")
	}

	if dm.onUpdate != nil {
		dm.onUpdate(userID, &cpy)
	}

	return &cpy, nil
}

// AddDevice registers a new device scoped to a user.
func (dm *DeviceManager) AddDevice(userID string, d model.Device) (*model.Device, error) {
	dm.mu.Lock()
	if _, ok := dm.devices[userID]; !ok {
		dm.devices[userID] = make(map[string]*model.Device)
	}

	if d.ID == "" {
		d.ID = fmt.Sprintf("device-%d", time.Now().UnixNano()%100000)
	}
	d.UserID = userID

	if d.Icon == "" {
		switch d.Type {
		case model.TypeFan:
			d.Icon = "🌀"
		case model.TypeDimmer:
			d.Icon = "🎛️"
		case model.TypeLock:
			d.Icon = "🔒"
		default:
			d.Icon = "💡"
		}
	}
	if d.Value == 0 && d.Type == model.TypeDimmer {
		d.Value = 50
	} else if d.Value == 0 && d.Type == model.TypeFan {
		d.Value = 50
	}
	d.LastUpdated = time.Now()
	dm.devices[userID][d.ID] = &d
	cpy := d
	dm.mu.Unlock()

	if dm.onUpdate != nil {
		dm.onUpdate(userID, &cpy)
	}

	dm.LogActivity(userID, "hardware", fmt.Sprintf("New device enrolled: %s (%s, Pin %d)", cpy.Name, cpy.Room, cpy.GPIOPin), "cloud")
	return &cpy, nil
}

// UpdateDevice updates an existing device's metadata.
func (dm *DeviceManager) UpdateDevice(userID, deviceID string, updated model.Device) (*model.Device, error) {
	dm.mu.Lock()
	userDevs, ok := dm.devices[userID]
	if !ok {
		dm.mu.Unlock()
		return nil, fmt.Errorf("device not found")
	}

	d, ok := userDevs[deviceID]
	if !ok {
		dm.mu.Unlock()
		return nil, fmt.Errorf("device not found")
	}

	d.Name = updated.Name
	d.Room = updated.Room
	d.Type = updated.Type
	d.GPIOPin = updated.GPIOPin
	d.PowerWatts = updated.PowerWatts
	d.LastUpdated = time.Now()
	cpy := *d
	dm.mu.Unlock()

	if dm.onUpdate != nil {
		dm.onUpdate(userID, &cpy)
	}

	dm.LogActivity(userID, "hardware", fmt.Sprintf("Device updated: %s (%s)", cpy.Name, cpy.Room), "cloud")
	return &cpy, nil
}

// DeleteDevice removes a device ensuring ownership.
func (dm *DeviceManager) DeleteDevice(userID, deviceID string) error {
	dm.mu.Lock()
	userDevs, ok := dm.devices[userID]
	if !ok {
		dm.mu.Unlock()
		return fmt.Errorf("device not found")
	}

	d, ok := userDevs[deviceID]
	if !ok {
		dm.mu.Unlock()
		return fmt.Errorf("device not found")
	}
	devName := d.Name
	delete(userDevs, deviceID)
	dm.mu.Unlock()

	dm.LogActivity(userID, "hardware", fmt.Sprintf("Device deleted: %s (%s)", devName, deviceID), "cloud")
	return nil
}

// GetAllScenes returns all automation presets for a user.
func (dm *DeviceManager) GetAllScenes(userID string) []model.Scene {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	userScenes, ok := dm.scenes[userID]
	if !ok {
		return []model.Scene{}
	}

	list := make([]model.Scene, 0, len(userScenes))
	for _, sc := range userScenes {
		list = append(list, sc)
	}

	sort.Slice(list, func(i, j int) bool {
		return list[i].ID < list[j].ID
	})
	return list
}

// ApplyScene triggers atomic preset activations.
func (dm *DeviceManager) ApplyScene(userID, sceneID string) error {
	dm.mu.RLock()
	userScenes, ok := dm.scenes[userID]
	if !ok {
		dm.mu.RUnlock()
		return fmt.Errorf("scene not found")
	}

	scene, ok := userScenes[sceneID]
	dm.mu.RUnlock()
	if !ok {
		return fmt.Errorf("scene %s not found", sceneID)
	}

	dm.LogActivity(userID, "hardware", fmt.Sprintf("Scene activated: '%s' (%s)", scene.Name, scene.Description), "cloud")

	for devID, targetState := range scene.Actions {
		dm.SetDeviceState(userID, devID, targetState, -1)
	}
	return nil
}

// GetTelemetry aggregates current energy, temperature, and hardware metrics.
func (dm *DeviceManager) GetTelemetry(userID string) model.Telemetry {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	t, ok := dm.telemetry[userID]
	if !ok {
		return model.Telemetry{
			UserID:      userID,
			Temperature: 22.0,
			Humidity:    45.0,
			TotalWatts:  0,
			ActiveCount: 0,
			TotalCount:  0,
			Timestamp:   time.Now(),
		}
	}

	var totalWatts float64
	active := 0
	total := 0
	if userDevs, exists := dm.devices[userID]; exists {
		total = len(userDevs)
		for _, d := range userDevs {
			if d.State {
				totalWatts += d.PowerWatts
				active++
			}
		}
	}

	t.TotalWatts = totalWatts
	t.ActiveCount = active
	t.TotalCount = total
	return t
}

// UpdateTelemetryFromEdge ingests live telemetry sent by the user's Edge CLI.
func (dm *DeviceManager) UpdateTelemetryFromEdge(userID string, tel model.Telemetry) {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	tel.UserID = userID
	dm.telemetry[userID] = tel

	// Update node heartbeat
	if node, exists := dm.hubNodes[userID]; exists {
		node.Online = true
		node.LastSeen = time.Now()
	}
}

// RecordEdgeOnline tracks an edge hardware CLI establishing its tunnel.
func (dm *DeviceManager) RecordEdgeOnline(userID, hubID string, isMock bool, pins []int) {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	dm.hubNodes[userID] = &model.HubNode{
		ID:       hubID,
		UserID:   userID,
		Name:     "Raspberry Pi Edge Controller",
		Online:   true,
		LastSeen: time.Now(),
		Pins:     pins,
		IsMock:   isMock,
	}

	dm.activities[userID] = append(dm.activities[userID], model.ActivityItem{
		ID:        fmt.Sprintf("act-%d", time.Now().UnixNano()),
		UserID:    userID,
		Timestamp: time.Now(),
		Category:  "hardware",
		Message:   fmt.Sprintf("Edge hardware CLI connected (Hub: %s, Mock: %v)", hubID, isMock),
		Source:    "edge-cli",
	})
}

// RecordEdgeOffline tracks an edge hardware CLI disconnecting.
func (dm *DeviceManager) RecordEdgeOffline(userID, hubID string) {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	if node, exists := dm.hubNodes[userID]; exists {
		node.Online = false
		node.LastSeen = time.Now()
	}

	dm.activities[userID] = append(dm.activities[userID], model.ActivityItem{
		ID:        fmt.Sprintf("act-%d", time.Now().UnixNano()),
		UserID:    userID,
		Timestamp: time.Now(),
		Category:  "system",
		Message:   "Edge hardware CLI disconnected. Reverting to cloud cached state.",
		Source:    "cloud",
	})
}

// IsEdgeOnline returns whether the edge CLI is currently connected.
func (dm *DeviceManager) IsEdgeOnline(userID string) bool {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	node, ok := dm.hubNodes[userID]
	return ok && node.Online
}

// GetSystemStatus returns multi-tenant health information.
func (dm *DeviceManager) GetSystemStatus(userID string) model.SystemStatus {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	userDevs := dm.devices[userID]
	active := 0
	for _, d := range userDevs {
		if d.State {
			active++
		}
	}

	edgeOnline := false
	if node, exists := dm.hubNodes[userID]; exists {
		edgeOnline = node.Online
	}

	hubName := "OmniHome Cloud"
	if s, exists := dm.settings[userID]; exists && s.HubName != "" {
		hubName = s.HubName
	}

	uptime := int64(time.Since(dm.startTime).Seconds())
	return model.SystemStatus{
		Status:        "online",
		Version:       "2.4.0-cloud",
		UptimeSeconds: uptime,
		Gateway:       hubName,
		DevicesCount:  len(userDevs),
		ActiveRelays:  active,
		EdgeConnected: edgeOnline,
		Timestamp:     time.Now(),
	}
}

// GetSettings retrieves a user's cloud settings.
func (dm *DeviceManager) GetSettings(userID string) model.Settings {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	if s, exists := dm.settings[userID]; exists {
		return s
	}
	return model.Settings{HubName: "OmniHome Cloud", AIProvider: "local"}
}

// UpdateSettings stores user-configured AI and gateway parameters.
func (dm *DeviceManager) UpdateSettings(userID string, s model.Settings) {
	dm.mu.Lock()
	defer dm.mu.Unlock()
	dm.settings[userID] = s
}

// GetActivities returns the audit activity ledger for a tenant.
func (dm *DeviceManager) GetActivities(userID string, limit int) []model.ActivityItem {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	acts, ok := dm.activities[userID]
	if !ok {
		return []model.ActivityItem{}
	}

	if limit <= 0 || limit > len(acts) {
		limit = len(acts)
	}

	res := make([]model.ActivityItem, limit)
	copy(res, acts[len(acts)-limit:])

	// Return most recent first
	for i, j := 0, len(res)-1; i < j; i, j = i+1, j-1 {
		res[i], res[j] = res[j], res[i]
	}
	return res
}

// LogActivity appends an activity record for a user.
func (dm *DeviceManager) LogActivity(userID, category, message, source string) model.ActivityItem {
	dm.mu.Lock()
	if _, exists := dm.activities[userID]; !exists {
		dm.activities[userID] = make([]model.ActivityItem, 0)
	}

	item := model.ActivityItem{
		ID:        fmt.Sprintf("act-%d", time.Now().UnixNano()),
		UserID:    userID,
		Timestamp: time.Now(),
		Category:  category,
		Message:   message,
		Source:    source,
	}

	dm.activities[userID] = append(dm.activities[userID], item)
	if len(dm.activities[userID]) > 150 {
		dm.activities[userID] = dm.activities[userID][len(dm.activities[userID])-150:]
	}
	cb := dm.onActivity
	dm.mu.Unlock()

	if cb != nil {
		cb(userID, &item)
	}
	return item
}

// ClearActivities empties the audit ledger for a user.
func (dm *DeviceManager) ClearActivities(userID string) {
	dm.mu.Lock()
	defer dm.mu.Unlock()
	dm.activities[userID] = make([]model.ActivityItem, 0)
}

// GetSnapshots returns surveillance snapshots for a user.
func (dm *DeviceManager) GetSnapshots(userID string) []model.CameraSnapshot {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	snaps, ok := dm.snapshots[userID]
	if !ok {
		return []model.CameraSnapshot{}
	}
	res := make([]model.CameraSnapshot, len(snaps))
	copy(res, snaps)
	return res
}

// AddSnapshot stores a snapshot for a user.
func (dm *DeviceManager) AddSnapshot(userID string, snap model.CameraSnapshot) model.CameraSnapshot {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	snap.ID = fmt.Sprintf("snap-%d", time.Now().UnixNano())
	snap.UserID = userID
	snap.Timestamp = time.Now()

	// Upload to RustFS object storage partitioned by date
	if snap.DataURL != "" && dm.storageClient != nil {
		raw := snap.DataURL
		if strings.Contains(raw, ",") {
			raw = strings.SplitN(raw, ",", 2)[1]
		}
		if rawBytes, err := base64.StdEncoding.DecodeString(raw); err == nil && len(rawBytes) > 0 {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			storagePath, errUpload := dm.storageClient.UploadFaceSnapshot(ctx, userID, snap.ID, rawBytes, snap.Timestamp)
			cancel()
			if errUpload == nil {
				snap.StoragePath = storagePath
				snap.StorageURL = fmt.Sprintf("/api/storage/file?path=%s", storagePath)
			}
		}
	}

	if _, exists := dm.snapshots[userID]; !exists {
		dm.snapshots[userID] = make([]model.CameraSnapshot, 0)
	}

	dm.snapshots[userID] = append(dm.snapshots[userID], snap)
	if len(dm.snapshots[userID]) > 30 {
		dm.snapshots[userID] = dm.snapshots[userID][len(dm.snapshots[userID])-30:]
	}
	return snap
}

func (dm *DeviceManager) telemetryWorker() {
	ticker := time.NewTicker(4 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-dm.stopChan:
			return
		case <-ticker.C:
			dm.mu.Lock()
			// Only simulate ambient fluctuations if edge CLI is not actively reporting
			for userID, tel := range dm.telemetry {
				if node, ok := dm.hubNodes[userID]; !ok || !node.Online {
					tel.Temperature = 22.4 + (rand.Float64()*0.4 - 0.2)
					tel.Humidity = 48.0 + (rand.Float64()*0.8 - 0.4)
					tel.CPUUsage = 3.5 + rand.Float64()*4.0
					tel.MemoryUsage = 21.0
					tel.CPUTemp = 38.0 + (rand.Float64()*1.0 - 0.5)
					tel.Timestamp = time.Now()
					dm.telemetry[userID] = tel
				}
			}
			dm.mu.Unlock()
		}
	}
}

// Close gracefully terminates background goroutines.
func (dm *DeviceManager) Close() {
	select {
	case <-dm.stopChan:
	default:
		close(dm.stopChan)
	}
}

// GetFaceProfiles returns all enrolled face profiles for a user.
func (dm *DeviceManager) GetFaceProfiles(userID string) []model.FaceProfile {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	userProfiles, ok := dm.faceProfiles[userID]
	if !ok {
		return []model.FaceProfile{}
	}

	list := make([]model.FaceProfile, 0, len(userProfiles))
	for _, p := range userProfiles {
		list = append(list, p)
	}

	sort.Slice(list, func(i, j int) bool {
		return list[i].CreatedAt.Before(list[j].CreatedAt)
	})
	return list
}

// GetFaceProfileByID returns a single profile by ID.
func (dm *DeviceManager) GetFaceProfileByID(userID, profileID string) (*model.FaceProfile, error) {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	userProfiles, ok := dm.faceProfiles[userID]
	if !ok {
		return nil, fmt.Errorf("profile not found")
	}
	p, ok := userProfiles[profileID]
	if !ok {
		return nil, fmt.Errorf("profile not found")
	}
	cpy := p
	return &cpy, nil
}

// AddFaceProfile stores a newly enrolled face profile.
func (dm *DeviceManager) AddFaceProfile(userID string, profile model.FaceProfile) model.FaceProfile {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	if _, ok := dm.faceProfiles[userID]; !ok {
		dm.faceProfiles[userID] = make(map[string]model.FaceProfile)
	}

	if profile.ID == "" {
		profile.ID = fmt.Sprintf("prof-%d", time.Now().UnixNano())
	}
	profile.UserID = userID
	profile.CreatedAt = time.Now()
	if profile.CooldownSec <= 0 {
		profile.CooldownSec = 30
	}

	// Upload enrolled avatar photo to RustFS
	if profile.PhotoURL != "" && dm.storageClient != nil && strings.HasPrefix(profile.PhotoURL, "data:") {
		raw := profile.PhotoURL
		if strings.Contains(raw, ",") {
			raw = strings.SplitN(raw, ",", 2)[1]
		}
		if rawBytes, err := base64.StdEncoding.DecodeString(raw); err == nil && len(rawBytes) > 0 {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			storagePath, errUpload := dm.storageClient.UploadProfilePhoto(ctx, userID, profile.ID, rawBytes, profile.CreatedAt)
			cancel()
			if errUpload == nil {
				profile.PhotoURL = fmt.Sprintf("/api/storage/file?path=%s", storagePath)
			}
		}
	}

	dm.faceProfiles[userID][profile.ID] = profile
	return profile
}

// DeleteFaceProfile removes an enrolled profile.
func (dm *DeviceManager) DeleteFaceProfile(userID, profileID string) error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	userProfiles, ok := dm.faceProfiles[userID]
	if !ok {
		return fmt.Errorf("profile not found")
	}
	if _, ok := userProfiles[profileID]; !ok {
		return fmt.Errorf("profile not found")
	}
	delete(userProfiles, profileID)
	return nil
}

// RecordFaceSeen updates the LastSeen timestamp on a profile.
func (dm *DeviceManager) RecordFaceSeen(userID, profileID string) *model.FaceProfile {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	userProfiles, ok := dm.faceProfiles[userID]
	if !ok {
		return nil
	}
	p, ok := userProfiles[profileID]
	if !ok {
		return nil
	}
	now := time.Now()
	p.LastSeen = &now
	dm.faceProfiles[userID][profileID] = p
	cpy := p
	return &cpy
}

// ExecuteFaceAction triggers the automated device or scene rule associated with an enrolled face profile.
func (dm *DeviceManager) ExecuteFaceAction(userID string, profile model.FaceProfile) (string, error) {
	switch profile.ActionType {
	case "turn_on":
		if profile.ActionDeviceID != "" {
			dev, err := dm.SetDeviceState(userID, profile.ActionDeviceID, true, 100)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("Turned ON %s (%s)", dev.Name, dev.Room), nil
		}
	case "turn_off":
		if profile.ActionDeviceID != "" {
			dev, err := dm.SetDeviceState(userID, profile.ActionDeviceID, false, 0)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("Turned OFF %s (%s)", dev.Name, dev.Room), nil
		}
	case "toggle":
		if profile.ActionDeviceID != "" {
			dev, err := dm.ToggleDevice(userID, profile.ActionDeviceID)
			if err != nil {
				return "", err
			}
			stateStr := "OFF"
			if dev.State {
				stateStr = "ON"
			}
			return fmt.Sprintf("Toggled %s to %s", dev.Name, stateStr), nil
		}
	case "scene":
		if profile.ActionSceneID != "" {
			if err := dm.ApplyScene(userID, profile.ActionSceneID); err != nil {
				return "", err
			}
			return fmt.Sprintf("Activated scene '%s'", profile.ActionSceneID), nil
		}
	}
	return "No automated action (Notification only)", nil
}

// ArchiveActivitiesOlderThan archives activities older than the specified duration to RustFS partitioned by date.
func (dm *DeviceManager) ArchiveActivitiesOlderThan(cutoff time.Duration) (map[string]int, error) {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	if dm.storageClient == nil {
		return nil, fmt.Errorf("storage client not configured")
	}

	threshold := time.Now().Add(-cutoff)
	archivedCounts := make(map[string]int)

	for userID, items := range dm.activities {
		var toKeep []model.ActivityItem
		toArchiveByDate := make(map[string][]model.ActivityItem)

		for _, item := range items {
			if item.Timestamp.Before(threshold) {
				dateStr := item.Timestamp.Format("2006-01-02")
				toArchiveByDate[dateStr] = append(toArchiveByDate[dateStr], item)
			} else {
				toKeep = append(toKeep, item)
			}
		}

		totalArchivedUser := 0
		for dateStr, dateItems := range toArchiveByDate {
			data, err := json.MarshalIndent(dateItems, "", "  ")
			if err != nil {
				continue
			}
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			_, err = dm.storageClient.UploadArchivedActivities(ctx, userID, dateStr, data)
			cancel()
			if err == nil {
				totalArchivedUser += len(dateItems)
			}
		}

		if totalArchivedUser > 0 {
			dm.activities[userID] = toKeep
			archivedCounts[userID] = totalArchivedUser
		}
	}

	return archivedCounts, nil
}

func (dm *DeviceManager) activityArchiveWorker() {
	ticker := time.NewTicker(30 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-dm.stopChan:
			return
		case <-ticker.C:
			// Automatically archive activity ledger entries older than 24 hours to RustFS
			_, _ = dm.ArchiveActivitiesOlderThan(24 * time.Hour)
		}
	}
}

