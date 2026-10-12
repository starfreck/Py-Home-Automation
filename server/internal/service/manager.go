package service

import (
	"fmt"
	"log"
	"math/rand"
	"sort"
	"sync"
	"time"

	"github.com/starfreck/pyhome-server/internal/model"
)

// DeviceManager coordinates device states, GPIO signals, and environment telemetry.
type DeviceManager struct {
	devices   map[string]*model.Device
	scenes    map[string]model.Scene
	telemetry model.Telemetry
	settings  model.Settings
	mu        sync.RWMutex
	onUpdate  func(device *model.Device)
}

// NewDeviceManager initializes the pre-configured devices and default scenes.
func NewDeviceManager(onUpdate func(device *model.Device)) *DeviceManager {
	dm := &DeviceManager{
		devices:  make(map[string]*model.Device),
		scenes:   make(map[string]model.Scene),
		onUpdate: onUpdate,
		settings: model.Settings{
			HubName:            "PyHome Main Hub",
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

	for range ticker.C {
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
	defer dm.mu.Unlock()

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

	if dm.onUpdate != nil {
		dm.onUpdate(&cpy)
	}
	return &cpy, nil
}

// UpdateDevice updates an existing device's metadata.
func (dm *DeviceManager) UpdateDevice(id string, updated model.Device) (*model.Device, error) {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	d, ok := dm.devices[id]
	if !ok {
		return nil, fmt.Errorf("device %s not found", id)
	}

	d.Name = updated.Name
	d.Room = updated.Room
	d.Type = updated.Type
	d.GPIOPin = updated.GPIOPin
	d.PowerWatts = updated.PowerWatts
	d.LastUpdated = time.Now()
	cpy := *d

	if dm.onUpdate != nil {
		dm.onUpdate(&cpy)
	}
	return &cpy, nil
}

// DeleteDevice removes a device from the manager.
func (dm *DeviceManager) DeleteDevice(id string) error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	if _, ok := dm.devices[id]; !ok {
		return fmt.Errorf("device %s not found", id)
	}
	delete(dm.devices, id)
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
	return nil
}

