package service

import (
	"testing"

	"github.com/starfreck/omnihome-server/internal/model"
)

func TestDeviceManagerOperations(t *testing.T) {
	dm := NewDeviceManager(nil, nil)
	defer dm.Close()

	t.Log("1. Getting devices")
	devices := dm.GetAllDevices()
	t.Logf("1b. Found %d devices", len(devices))
	if len(devices) == 0 {
		t.Fatalf("expected default devices, got 0")
	}

	// 2. Toggle device
	t.Log("2. Toggling device")
	firstID := devices[0].ID
	initialState := devices[0].State
	updated, err := dm.ToggleDevice(firstID)
	t.Log("2b. Toggled device")
	if err != nil {
		t.Fatalf("failed to toggle device: %v", err)
	}
	if updated.State == initialState {
		t.Fatalf("expected state to toggle from %v, got %v", initialState, updated.State)
	}

	// 3. Set Device State
	t.Log("3. Setting device state")
	dimmer, err := dm.SetDeviceState(firstID, true, 75)
	t.Log("3b. Set device state done")
	if err != nil {
		t.Fatalf("failed to set device state: %v", err)
	}
	if !dimmer.State || dimmer.Value != 75 {
		t.Fatalf("expected state=true, value=75, got state=%v, value=%v", dimmer.State, dimmer.Value)
	}

	// 4. Add custom device
	t.Log("4. Adding device")
	customDev := model.Device{
		ID:         "test-dev-1",
		Name:       "Garden Sprinkler",
		Type:       model.TypeRelay,
		Room:       "Garden",
		State:      false,
		PowerWatts: 15.0,
		Icon:       "🌱",
	}
	created, err := dm.AddDevice(customDev)
	t.Log("4b. Added device")
	if err != nil {
		t.Fatalf("failed to add device: %v", err)
	}
	if created.ID != "test-dev-1" {
		t.Fatalf("expected ID test-dev-1, got %s", created.ID)
	}

	// 5. Delete device
	t.Log("5. Deleting device")
	if err := dm.DeleteDevice("test-dev-1"); err != nil {
		t.Fatalf("failed to delete device: %v", err)
	}
	t.Log("5b. Deleted device")

	// 6. Test Scenes
	t.Log("6. Scenes")
	scenes := dm.GetAllScenes()
	if len(scenes) == 0 {
		t.Fatalf("expected default scenes, got 0")
	}
	if err := dm.ApplyScene(scenes[0].ID); err != nil {
		t.Fatalf("failed to apply scene: %v", err)
	}
	t.Log("6b. Scene applied")

	// 7. Check System Status
	t.Log("7. System status")
	status := dm.GetSystemStatus()
	if status.Status != "online" {
		t.Fatalf("expected online status, got %s", status.Status)
	}
	t.Log("7b. System status done")
}
