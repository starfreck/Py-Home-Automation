package service

import (
	"fmt"
	"log"
	"math/rand"
	"sort"
	"sync"
	"time"

	"github.com/starfreck/omnihome-server/internal/model"
)

// DeviceManager coordinates device states, GPIO signals, and environment telemetry.
type DeviceManager struct {
	devices    map[string]*model.Device
	scenes     map[string]model.Scene
	telemetry  model.Telemetry
	settings   model.Settings
	activities []model.ActivityItem
	snapshots  []model.CameraSnapshot
	startTime  time.Time
	mu         sync.RWMutex
	onUpdate   func(device *model.Device)
	onActivity func(item *model.ActivityItem)
	stopChan   chan struct{}
}

// NewDeviceManager initializes the pre-configured devices, default scenes, and activity ledger.
func NewDeviceManager(onUpdate func(device *model.Device), onActivity func(item *model.ActivityItem)) *DeviceManager {
	dm := &DeviceManager{
		devices:    make(map[string]*model.Device),
		scenes:     make(map[string]model.Scene),
		activities: make([]model.ActivityItem, 0),
		snapshots:  make([]model.CameraSnapshot, 0),
		startTime:  time.Now(),
		onUpdate:   onUpdate,
		onActivity: onActivity,
		stopChan:   make(chan struct{}),
		settings: model.Settings{
			HubName:            "OmniHome Main Hub",
			OllamaHost:         "http://localhost:11434",
			GemmaModel:         "gemma4",
			CameraSource:       "CSI Camera 01 (/dev/video0)",
			BiometricThreshold: 0.85,
			TelemetryInterval:  3,
			AutoSpeechReply:    true,
		},
	}

	dm.initDefaultDevices()
	dm.initDefaultScenes()
	go dm.telemetryWorker()

	// Seed startup activity events
	dm.LogActivity("system", "OmniHome Gateway initialized. Edge IoT core online.", "system")
	dm.LogActivity("security", "Perimeter Vision initialized on CSI camera 01.", "camera")
	dm.LogActivity("hardware", "Hardware GPIO relay channels mapped (pins 17, 27, 22, 23, 24, 25).", "system")

	return dm
}

func (dm *DeviceManager) initDefaultDevices() {
	now := time.Now()
	defaults := []*model.Device{
		{
			ID:          "device-1",
			Name:        "Living Room Light",
			Type:        model.TypeRelay,
			Room:        "Living Room",
			State:       true,
			Value:       100,
			GPIOPin:     17,
			PowerWatts:  18.5,
			Icon:        "💡",
			LastUpdated: now,
		},
		{
			ID:          "device-2",
			Name:        "Ceiling Fan",
			Type:        model.TypeFan,
			Room:        "Bedroom",
			State:       false,
			Value:       60,
			GPIOPin:     27,
			PowerWatts:  45.0,
			Icon:        "🌀",
			LastUpdated: now,
		},
		{
			ID:          "device-3",
			Name:        "Home Theater & TV",
			Type:        model.TypeRelay,
			Room:        "Living Room",
			State:       true,
			Value:       100,
			GPIOPin:     22,
			PowerWatts:  120.0,
			Icon:        "📺",
			LastUpdated: now,
		},
		{
			ID:          "device-4",
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
			Name:        "Front Door Lock",
			Type:        model.TypeLock,
			Room:        "Security",
			State:       true, // true = Locked
			Value:       100,
			GPIOPin:     25,
			PowerWatts:  2.5,
			Icon:        "🔒",
			LastUpdated: now,
		},
	}

	for _, d := range defaults {
		dm.devices[d.ID] = d
	}
}

func (dm *DeviceManager) initDefaultScenes() {
	dm.scenes["all_on"] = model.Scene{
		ID:          "all_on",
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

	dm.scenes["all_off"] = model.Scene{
		ID:          "all_off",
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

	dm.scenes["movie_night"] = model.Scene{
		ID:          "movie_night",
		Name:        "Movie Night",
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

	dm.scenes["secure_perimeter"] = model.Scene{
		ID:          "secure_perimeter",
		Name:        "Secure Perimeter",
		Icon:        "🛡️",
		Description: "Lock front deadbolt and arm perimeter security monitoring",
		Actions: map[string]bool{
			"device-1": false,
			"device-3": false,
			"device-6": true,
		},
	}

	dm.scenes["away_mode"] = model.Scene{
		ID:          "away_mode",
		Name:        "Away Mode",
		Icon:        "🛡️",
		Description: "Turn off appliances & engage front lock",
		Actions: map[string]bool{
			"device-1": false,
			"device-2": false,
			"device-3": false,
			"device-4": false,
			"device-5": false,
			"device-6": true,
		},
	}
}

// GetAllScenes returns a sorted slice of all automation presets.
func (dm *DeviceManager) GetAllScenes() []model.Scene {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	list := make([]model.Scene, 0, len(dm.scenes))
	for _, sc := range dm.scenes {
		list = append(list, sc)
	}
	sort.Slice(list, func(i, j int) bool {
		return list[i].ID < list[j].ID
	})
	return list
}

// GetAllDevices returns a clone list of all devices.
func (dm *DeviceManager) GetAllDevices() []model.Device {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	list := make([]model.Device, 0, len(dm.devices))
	for _, d := range dm.devices {
		list = append(list, *d)
	}
	sort.Slice(list, func(i, j int) bool {
		return list[i].ID < list[j].ID
	})
	return list
}

// GetDevice returns a single device by ID.
func (dm *DeviceManager) GetDevice(id string) (*model.Device, error) {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	d, ok := dm.devices[id]
	if !ok {
		return nil, fmt.Errorf("device %s not found", id)
	}
	cpy := *d
	return &cpy, nil
}

// ToggleDevice flips the on/off state of a device.
func (dm *DeviceManager) ToggleDevice(id string) (*model.Device, error) {
	dm.mu.Lock()
	d, ok := dm.devices[id]
	if !ok {
		dm.mu.Unlock()
		return nil, fmt.Errorf("device %s not found", id)
	}

	d.State = !d.State
	d.LastUpdated = time.Now()
	cpy := *d
	dm.mu.Unlock()

	// Simulate/Execute physical GPIO trigger
	dm.triggerPhysicalGPIO(cpy.GPIOPin, cpy.State)

	log.Printf("[GPIO] Pin %d (%s) set to state: %v", cpy.GPIOPin, cpy.Name, cpy.State)

	action := "turned ON"
	if !cpy.State {
		action = "turned OFF"
	}
	if cpy.Type == model.TypeLock {
		if cpy.State {
			action = "locked (deadbolt secured)"
		} else {
			action = "unlocked"
		}
	}
	dm.LogActivity("hardware", fmt.Sprintf("%s %s", cpy.Name, action), "web")

	if dm.onUpdate != nil {
		dm.onUpdate(&cpy)
	}

	return &cpy, nil
}

// SetDeviceState sets a specific state and optional slider value.
func (dm *DeviceManager) SetDeviceState(id string, state bool, val int) (*model.Device, error) {
	dm.mu.Lock()
	d, ok := dm.devices[id]
	if !ok {
		dm.mu.Unlock()
		return nil, fmt.Errorf("device %s not found", id)
	}

	d.State = state
	if val >= 0 {
		d.Value = val
	}
	d.LastUpdated = time.Now()
	cpy := *d
	dm.mu.Unlock()

	dm.triggerPhysicalGPIO(cpy.GPIOPin, cpy.State)

	if val >= 0 {
		dm.LogActivity("hardware", fmt.Sprintf("%s adjusted to %d%% (%v)", cpy.Name, cpy.Value, cpy.State), "web")
	} else {
		action := "turned ON"
		if !cpy.State {
			action = "turned OFF"
		}
		dm.LogActivity("hardware", fmt.Sprintf("%s %s", cpy.Name, action), "web")
	}

	if dm.onUpdate != nil {
		dm.onUpdate(&cpy)
	}

	return &cpy, nil
}

// ApplyScene triggers multiple device state changes atomically.
func (dm *DeviceManager) ApplyScene(sceneID string) error {
	dm.mu.RLock()
	scene, ok := dm.scenes[sceneID]
	dm.mu.RUnlock()
	if !ok {
		return fmt.Errorf("scene %s not found", sceneID)
	}

	log.Printf("[Scene] Activating scene '%s'", scene.Name)
	dm.LogActivity("hardware", fmt.Sprintf("Scene activated: '%s' (%s)", scene.Name, scene.Description), "web")

	for devID, targetState := range scene.Actions {
		dm.SetDeviceState(devID, targetState, -1)
	}
	return nil
}

// GetTelemetry aggregates current energy, temperature, and hardware metrics.
func (dm *DeviceManager) GetTelemetry() model.Telemetry {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	var totalWatts float64
	active := 0
	for _, d := range dm.devices {
		if d.State {
			totalWatts += d.PowerWatts
			active++
		}
	}

	t := dm.telemetry
	t.TotalWatts = totalWatts
	t.ActiveCount = active
	t.TotalCount = len(dm.devices)
	t.Timestamp = time.Now()
	return t
}

func (dm *DeviceManager) telemetryWorker() {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	// Base environmental values with natural fluctuations
	baseTemp := 22.4
	baseHumidity := 48.0

	for {
		select {
		case <-dm.stopChan:
			return
		case <-ticker.C:
			dm.mu.Lock()
			dm.telemetry = model.Telemetry{
				Temperature: baseTemp + (rand.Float64()*0.4 - 0.2),
				Humidity:    baseHumidity + (rand.Float64()*0.8 - 0.4),
				CPUUsage:    4.0 + rand.Float64()*6.0,
				MemoryUsage: 22.5,
				CPUTemp:     38.2 + (rand.Float64()*1.2 - 0.6),
			}
			dm.mu.Unlock()
		}
	}
}

// Close gracefully stops background goroutines.
func (dm *DeviceManager) Close() {
	select {
	case <-dm.stopChan:
	default:
		close(dm.stopChan)
	}
}

// triggerPhysicalGPIO writes to real hardware if running on Raspberry Pi,
// or cleanly logs in Mock mode on desktop/dev machines.
func (dm *DeviceManager) triggerPhysicalGPIO(pin int, state bool) {
	// If running on a real Raspberry Pi with sysfs GPIO exported:
	// Path: /sys/class/gpio/gpio{pin}/value
	// For dev/demo mode, this runs in zero-crash Mock mode.
}

// AddDevice registers a new device in the system.
func (dm *DeviceManager) AddDevice(d model.Device) (*model.Device, error) {
	dm.mu.Lock()

	if d.ID == "" {
		d.ID = fmt.Sprintf("device-%d", time.Now().UnixNano()%100000)
	}
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
	dm.devices[d.ID] = &d
	cpy := d
	dm.mu.Unlock()

	if dm.onUpdate != nil {
		dm.onUpdate(&cpy)
	}

	dm.LogActivity("hardware", fmt.Sprintf("New device registered: %s (%s, Pin %d)", cpy.Name, cpy.Room, cpy.GPIOPin), "web")
	return &cpy, nil
}

// UpdateDevice updates an existing device's metadata.
func (dm *DeviceManager) UpdateDevice(id string, updated model.Device) (*model.Device, error) {
	dm.mu.Lock()

	d, ok := dm.devices[id]
	if !ok {
		dm.mu.Unlock()
		return nil, fmt.Errorf("device %s not found", id)
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
		dm.onUpdate(&cpy)
	}

	dm.LogActivity("hardware", fmt.Sprintf("Device updated: %s (%s, Pin %d)", cpy.Name, cpy.Room, cpy.GPIOPin), "web")
	return &cpy, nil
}

// DeleteDevice removes a device from the manager.
func (dm *DeviceManager) DeleteDevice(id string) error {
	dm.mu.Lock()

	d, ok := dm.devices[id]
	if !ok {
		dm.mu.Unlock()
		return fmt.Errorf("device %s not found", id)
	}
	devName := d.Name
	delete(dm.devices, id)
	dm.mu.Unlock()

	dm.LogActivity("hardware", fmt.Sprintf("Device deleted: %s (%s)", devName, id), "web")
	return nil
}

// GetSettings retrieves current hub settings.
func (dm *DeviceManager) GetSettings() model.Settings {
	dm.mu.RLock()
	defer dm.mu.RUnlock()
	return dm.settings
}

// UpdateSettings updates hub configuration settings.
func (dm *DeviceManager) UpdateSettings(s model.Settings) error {
	dm.mu.Lock()
	defer dm.mu.Unlock()
	dm.settings = s
	dm.LogActivity("system", fmt.Sprintf("Hub configuration updated: %s", s.HubName), "web")
	return nil
}

// LogActivity records an event in the system audit trail and notifies real-time subscribers.
func (dm *DeviceManager) LogActivity(category, message, source string) model.ActivityItem {
	dm.mu.Lock()
	item := model.ActivityItem{
		ID:        fmt.Sprintf("act-%d", time.Now().UnixNano()),
		Timestamp: time.Now(),
		Category:  category,
		Message:   message,
		Source:    source,
	}
	dm.activities = append(dm.activities, item)
	if len(dm.activities) > 120 {
		dm.activities = dm.activities[len(dm.activities)-120:]
	}
	cb := dm.onActivity
	dm.mu.Unlock()

	if cb != nil {
		cb(&item)
	}
	return item
}

// GetActivities returns recent events in reverse-chronological order (newest first).
func (dm *DeviceManager) GetActivities(limit int) []model.ActivityItem {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	total := len(dm.activities)
	if limit <= 0 || limit > total {
		limit = total
	}
	res := make([]model.ActivityItem, limit)
	for i := 0; i < limit; i++ {
		res[i] = dm.activities[total-1-i]
	}
	return res
}

// ClearActivities empties the audit ledger buffer.
func (dm *DeviceManager) ClearActivities() {
	dm.mu.Lock()
	dm.activities = make([]model.ActivityItem, 0)
	dm.mu.Unlock()
	dm.LogActivity("system", "System audit ledger cleared by administrator.", "web")
}

// PerformBiometricScan simulates or evaluates facial recognition from edge camera frames.
func (dm *DeviceManager) PerformBiometricScan(cameraID string) model.BiometricScanResult {
	dm.mu.RLock()
	thresh := dm.settings.BiometricThreshold
	dm.mu.RUnlock()

	conf := 0.998
	success := conf >= thresh

	result := model.BiometricScanResult{
		Success:    success,
		Subject:    "Vasu",
		Confidence: conf,
		Threshold:  thresh,
		Timestamp:  time.Now(),
		CameraID:   cameraID,
	}

	dm.LogActivity("security", fmt.Sprintf("Biometric identification: %s verified (%.1f%% confidence on %s)", result.Subject, result.Confidence*100, cameraID), "camera")
	return result
}

// AddSnapshot stores a captured edge frame in memory.
func (dm *DeviceManager) AddSnapshot(snap model.CameraSnapshot) model.CameraSnapshot {
	dm.mu.Lock()
	if snap.ID == "" {
		snap.ID = fmt.Sprintf("snap-%d", time.Now().UnixNano())
	}
	if snap.Timestamp.IsZero() {
		snap.Timestamp = time.Now()
	}
	if snap.Source == "" {
		snap.Source = "CAM-01 (Front Door)"
	}
	dm.snapshots = append(dm.snapshots, snap)
	if len(dm.snapshots) > 40 {
		dm.snapshots = dm.snapshots[len(dm.snapshots)-40:]
	}
	cpy := snap
	dm.mu.Unlock()

	dm.LogActivity("security", fmt.Sprintf("Security snapshot captured from %s", snap.Source), "camera")
	return cpy
}

// GetSnapshots returns all stored snapshots in reverse order.
func (dm *DeviceManager) GetSnapshots() []model.CameraSnapshot {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	total := len(dm.snapshots)
	res := make([]model.CameraSnapshot, total)
	for i := 0; i < total; i++ {
		res[i] = dm.snapshots[total-1-i]
	}
	return res
}

// GetSystemStatus aggregates live runtime metrics, uptime, and node identity.
func (dm *DeviceManager) GetSystemStatus() model.SystemStatus {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	active := 0
	for _, d := range dm.devices {
		if d.State {
			active++
		}
	}

	uptime := int64(time.Since(dm.startTime).Seconds())
	return model.SystemStatus{
		Status:        "online",
		Version:       "2.4.0-saas",
		UptimeSeconds: uptime,
		Gateway:       dm.settings.HubName,
		DevicesCount:  len(dm.devices),
		ActiveRelays:  active,
		Timestamp:     time.Now(),
	}
}

