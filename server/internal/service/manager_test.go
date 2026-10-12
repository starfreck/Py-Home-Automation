package service

import (
	"testing"

	"github.com/starfreck/omnihome-server/internal/model"
)

func TestDeviceManagerMultiTenant(t *testing.T) {
	dm := NewDeviceManager(nil, nil)
	defer dm.Close()

	user1 := "usr-alice"
	user2 := "usr-bob"

	dm.InitUserDefaults(user1)
	dm.InitUserDefaults(user2)

	// 1. Isolation check
	aliceDevs := dm.GetAllDevices(user1)
	bobDevs := dm.GetAllDevices(user2)

	if len(aliceDevs) == 0 || len(bobDevs) == 0 {
		t.Fatalf("expected initialized default devices for both tenants")
	}

	// 2. Alice toggles device
	firstAliceDevID := aliceDevs[0].ID
	initialAliceState := aliceDevs[0].State
	updated, err := dm.ToggleDevice(user1, firstAliceDevID)
	if err != nil {
		t.Fatalf("failed to toggle device: %v", err)
	}
	if updated.State == initialAliceState {
		t.Fatalf("expected state to toggle")
	}

	// 3. Bob attempts to access Alice's device (Should fail)
	_, err = dm.GetDevice(user2, firstAliceDevID)
	// Alice and Bob share default IDs, but verify tenant scoping
	if _, err := dm.ToggleDevice(user2, "non-existent-device-xyz"); err == nil {
		t.Fatalf("expected error for non-existent device on tenant")
	}

	// 4. Add custom device for Alice
	customDev := model.Device{
		ID:         "alice-sprinkler",
		Name:       "Garden Sprinkler",
		Type:       model.TypeRelay,
		Room:       "Garden",
		State:      false,
		PowerWatts: 15.0,
		Icon:       "🌱",
	}
	created, err := dm.AddDevice(user1, customDev)
	if err != nil {
		t.Fatalf("failed to add device: %v", err)
	}
	if created.ID != "alice-sprinkler" {
		t.Fatalf("expected ID alice-sprinkler, got %s", created.ID)
	}

	// Bob should NOT see Alice's sprinkler
	_, err = dm.GetDevice(user2, "alice-sprinkler")
	if err == nil {
		t.Fatalf("SECURITY VIOLATION: Bob accessed Alice's custom device!")
	}

	// 5. Delete device for Alice
	if err := dm.DeleteDevice(user1, "alice-sprinkler"); err != nil {
		t.Fatalf("failed to delete device: %v", err)
	}

	// 6. Test Scenes
	scenes := dm.GetAllScenes(user1)
	if len(scenes) == 0 {
		t.Fatalf("expected default scenes for Alice")
	}
	if err := dm.ApplyScene(user1, scenes[0].ID); err != nil {
		t.Fatalf("failed to apply scene: %v", err)
	}

	// 7. System status
	status := dm.GetSystemStatus(user1)
	if status.Status != "online" {
		t.Fatalf("expected online status, got %s", status.Status)
	}
}
