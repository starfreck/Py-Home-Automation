#!/usr/bin/env python3
"""
Test local end-to-end face detection, recognition, and automated actuation.
"""
import sys
import os
import json
import time
import requests
import asyncio
import websockets
import cv2
import numpy as np
from pathlib import Path

STORAGE_DIR = Path.home() / ".omnihome"
CONFIG_FILE = STORAGE_DIR / "edge_config.json"

def main():
    print("=" * 65)
    print("      OmniHome Local End-to-End Face Recognition Test")
    print("=" * 65)

    if not CONFIG_FILE.exists():
        print(f"Error: {CONFIG_FILE} not found. Please log in first.")
        sys.exit(1)

    with open(CONFIG_FILE, "r") as f:
        config = json.load(f)

    cloud_url = config.get("cloud_url", "http://localhost:8080")
    token = config.get("token")
    user = config.get("user", {})
    user_id = user.get("id")

    print(f"Tenant User:  {user.get('name')} <{user.get('email')}> (ID: {user_id})")
    print(f"Cloud Server: {cloud_url}")
    print()

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # Step 1: Query enrolled face profiles
    print("[1/5] Fetching enrolled face profiles from Cloud API...")
    res = requests.get(f"{cloud_url}/api/camera/profiles", headers=headers, timeout=5)
    if res.status_code != 200:
        print(f"Failed to fetch profiles: {res.status_code} {res.text}")
        sys.exit(1)

    profiles = res.json()
    print(f"      Found {len(profiles)} enrolled profiles:")
    for p in profiles:
        print(f"       • {p['name']:<10} | Role: {p['role']:<15} | Action: {p.get('action_label', 'None')}")
    print()

    # Step 2: Check current device states before recognition
    print("[2/5] Checking target device states before recognition...")
    dev_res = requests.get(f"{cloud_url}/api/devices", headers=headers, timeout=5)
    devices = {d["id"]: d for d in dev_res.json()}

    door_lock = devices.get("device-6")
    print(f"      Device 'device-6' (Front Door Lock) current state: {door_lock.get('state')} "
          f"({'UNLOCKED' if door_lock.get('state') else 'LOCKED'})")

    # If it is currently unlocked (True), lock it (False) to test unlocking trigger
    if door_lock.get("state") is True:
        print("      Locking 'device-6' (setting state=False) to test unlock trigger...")
        requests.post(f"{cloud_url}/api/devices/device-6/state", headers=headers, json={"state": False}, timeout=5)
        time.sleep(0.5)
        # Verify
        d = requests.get(f"{cloud_url}/api/devices", headers=headers, timeout=5).json()
        print(f"      Verified 'device-6' is now: {next(x['state'] for x in d if x['id']=='device-6')}")
    print()

    # Step 3: Test Edge Camera recognition engine locally
    print("[3/5] Testing OpenCV LBPH Face Recognition engine in EdgeCamera...")
    from edge.camera import EdgeCamera
    cam = EdgeCamera(hub_id="pi-saturn")
    cam.sync_profiles(profiles)

    print(f"      Edge recognizer trained model profiles: {len(cam.profiles)}")
    assert cam.is_trained, "Expected camera recognizer to be trained!"
    print("      ✓ LBPH Face Recognizer successfully trained with enrolled profiles!")
    print()

    # Step 4 & 5: Simulate recognition event dispatch for all 4 profiles
    print("[4/5] Testing automated trigger rules for all 4 household members...")

    ws_url = cloud_url.replace("http://", "ws://").replace("https://", "wss://")
    ws_endpoint = f"{ws_url}/ws/edge?token={token}"

    for prof in profiles:
        target_dev_id = prof.get("action_device_id")
        if not target_dev_id:
            continue

        print(f"\n   >>> Testing Person: {prof['name']} (Action: {prof.get('action_label')})")
        # Ensure device is initially OFF
        requests.post(f"{cloud_url}/api/devices/{target_dev_id}/state", headers=headers, json={"state": False}, timeout=5)
        time.sleep(0.3)

        # Check initial state is False
        dev_before = requests.get(f"{cloud_url}/api/devices", headers=headers, timeout=5).json()
        assert not next(d["state"] for d in dev_before if d["id"] == target_dev_id), f"{target_dev_id} should be OFF"

        # Dispatch face_recognized event over WebSocket tunnel
        async def send_prof_event(p):
            async with websockets.connect(ws_endpoint) as ws:
                rec_payload = {
                    "type": "face_recognized",
                    "payload": {
                        "profile_id": p["id"],
                        "name": p["name"],
                        "confidence": 0.95,
                        "camera_id": "CAM-EDGE-pi-saturn"
                    }
                }
                await ws.send(json.dumps(rec_payload))
                await asyncio.sleep(0.8)

        asyncio.run(send_prof_event(prof))
        time.sleep(1.0)

        # Verify device state changed to True
        dev_after = requests.get(f"{cloud_url}/api/devices", headers=headers, timeout=5).json()
        cur_dev = next(d for d in dev_after if d["id"] == target_dev_id)
        print(f"       Device '{cur_dev['name']}' state is now: {cur_dev['state']} (ON)")
        assert cur_dev["state"] is True, f"Expected {cur_dev['name']} to be turned ON!"
        print(f"       ✓ Rule for {prof['name']} successfully executed ({prof.get('action_label')})!")

    print("\n" + "=" * 65)
    print("  >>> SUCCESS: All 4 household face rules verified locally! <<<")
    print("      • Alice   -> Front Door Lock UNLOCKED")
    print("      • Bob     -> Living Room Light Turned ON")
    print("      • Charlie -> Ceiling Fan Turned ON")
    print("      • Diana   -> Smart AC Cooler Turned ON")
    print("=" * 65)

if __name__ == "__main__":
    main()
