package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"testing"
	"time"
)

func TestRustFSStorageMultiTenantIsolation(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "rustfs_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	client := NewClient(Config{
		Endpoint: "127.0.0.1:9000",
		LocalDir: tempDir,
	})

	ctx := context.Background()
	userA := "usr-alice-123"
	userB := "usr-bob-456"
	testDate := time.Date(2026, 10, 13, 14, 30, 0, 0, time.UTC)
	jpegData := []byte("fake-jpeg-data-stream-for-alice")

	// 1. User A uploads face snapshot
	snapshotID := "snap-alice-001"
	pathA, err := client.UploadFaceSnapshot(ctx, userA, snapshotID, jpegData, testDate)
	if err != nil {
		t.Fatalf("failed to upload face snapshot: %v", err)
	}

	expectedPrefix := fmt.Sprintf("users/%s/faces/2026/10/13/%s.jpg", userA, snapshotID)
	if pathA != expectedPrefix {
		t.Fatalf("expected path %s, got %s", expectedPrefix, pathA)
	}

	// 2. User A reads back their own file -> SUCCESS
	rc, ct, size, err := client.GetUserObject(ctx, userA, pathA)
	if err != nil {
		t.Fatalf("User A failed to retrieve their own file: %v", err)
	}
	defer rc.Close()

	readBytes, _ := io.ReadAll(rc)
	if string(readBytes) != string(jpegData) {
		t.Fatalf("content mismatch: got %s, expected %s", string(readBytes), string(jpegData))
	}
	if ct != "image/jpeg" {
		t.Fatalf("expected image/jpeg, got %s", ct)
	}
	if size <= 0 {
		t.Fatalf("expected positive size, got %d", size)
	}

	// 3. User B attempts to access User A's file -> MUST BE REJECTED with ErrAccessDenied
	_, _, _, errB := client.GetUserObject(ctx, userB, pathA)
	if errB == nil {
		t.Fatalf("CRITICAL SECURITY VULNERABILITY: User B was able to access User A's private file!")
	}
	if !errors.Is(errB, ErrAccessDenied) {
		t.Fatalf("expected ErrAccessDenied, got %v", errB)
	}

	// 4. Test listing face snapshots by date
	snapshots, err := client.ListUserObjectsByDate(ctx, userA, "faces", "2026-10-13")
	if err != nil {
		t.Fatalf("failed to list snapshots: %v", err)
	}
	if len(snapshots) == 0 {
		t.Fatalf("expected at least 1 snapshot in list, got 0")
	}
	if snapshots[0].Date != "2026-10-13" {
		t.Fatalf("expected date 2026-10-13, got %s", snapshots[0].Date)
	}

	// 5. Test available dates
	dates, err := client.ListAvailableDates(ctx, userA, "faces")
	if err != nil {
		t.Fatalf("failed to list dates: %v", err)
	}
	if len(dates) == 0 || dates[0] != "2026-10-13" {
		t.Fatalf("expected available dates to include 2026-10-13, got %v", dates)
	}

	// 6. Test User B gets an empty list for their own tenant
	snapshotsB, err := client.ListUserObjectsByDate(ctx, userB, "faces", "2026-10-13")
	if err != nil {
		t.Fatalf("failed to list snapshots for User B: %v", err)
	}
	if len(snapshotsB) != 0 {
		t.Fatalf("expected User B to see 0 snapshots, but found %d", len(snapshotsB))
	}

	// 7. Test 24-hour activity archival storage by date
	actJSON := []byte(`[{"id":"act-1","message":"Motion detected at perimeter"}]`)
	actPath, err := client.UploadArchivedActivities(ctx, userA, "2026-10-12", actJSON)
	if err != nil {
		t.Fatalf("failed to archive activities: %v", err)
	}

	expectedActPath := fmt.Sprintf("users/%s/activities/2026/10/12/activities.json", userA)
	if actPath != expectedActPath {
		t.Fatalf("expected path %s, got %s", expectedActPath, actPath)
	}

	// Read archived activities back
	retrievedAct, err := client.GetArchivedActivities(ctx, userA, "2026-10-12")
	if err != nil {
		t.Fatalf("failed to read archived activities: %v", err)
	}
	if string(retrievedAct) != string(actJSON) {
		t.Fatalf("expected %s, got %s", string(actJSON), string(retrievedAct))
	}

	// User B trying to access User A's archived activities -> MUST FAIL
	_, errBAct := client.GetArchivedActivities(ctx, userB, "2026-10-12")
	if errBAct == nil {
		t.Fatalf("CRITICAL SECURITY VULNERABILITY: User B accessed User A's archived activities!")
	}
}
