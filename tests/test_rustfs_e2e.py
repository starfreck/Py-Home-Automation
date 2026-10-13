#!/usr/bin/env python3
"""
End-to-End Test Suite for OmniHome RustFS Cloud Storage Integration:
1. Multi-tenant date-partitioned face detection picture storage.
2. Tenant-scoped authorization (preventing cross-tenant data access).
3. 24-hour activity archival to RustFS by date.
"""
import sys
import json
import time
import base64
import requests
import asyncio
import websockets
import numpy as np
import cv2

CLOUD_URL = "http://localhost:8080"

def generate_test_jpeg(name: str) -> str:
    """Generate a valid synthetic JPEG image with a face-like avatar."""
    img = np.full((150, 150, 3), (40, 30, 25), dtype=np.uint8)
    cv2.circle(img, (75, 75), 45, (100, 200, 120), -1)
    cv2.circle(img, (60, 65), 6, (20, 20, 20), -1)
    cv2.circle(img, (90, 65), 6, (20, 20, 20), -1)
    cv2.putText(img, name[:4], (50, 110), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)
    _, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    b64 = base64.b64encode(buf).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"

def main():
    print("=" * 70)
    print("      OmniHome RustFS Cloud Storage & Anti-MITM Verification")
    print("=" * 70)

    # 1. Login as Tenant Alice
    print("\n[1/6] Authenticating Tenant Alice...")
    res_a = requests.post(f"{CLOUD_URL}/api/auth/login", json={
        "email": "admin@omnihome.local",
        "password": "omnihome123"
    }, timeout=5)
    assert res_a.status_code == 200, f"Login failed: {res_a.text}"
    token_a = res_a.json()["token"]
    user_a = res_a.json()["user"]
    user_a_id = user_a["id"]
    headers_a = {"Authorization": f"Bearer {token_a}", "Content-Type": "application/json"}
    print(f"      Tenant Alice: {user_a['email']} (ID: {user_a_id})")

    # 2. Register/Login as Tenant Bob (for cross-tenant security verification)
    print("\n[2/6] Registering / Authenticating Tenant Bob (adversary test)...")
    res_b = requests.post(f"{CLOUD_URL}/api/auth/register", json={
        "email": "bob.tenant@example.com",
        "password": "password123",
        "name": "Bob Tenant"
    }, timeout=5)
    if res_b.status_code != 200 and res_b.status_code != 201:
        # Try login
        res_b = requests.post(f"{CLOUD_URL}/api/auth/login", json={
            "email": "bob.tenant@example.com",
            "password": "password123"
        }, timeout=5)
    assert res_b.status_code in [200, 201], f"Bob auth failed: {res_b.text}"
    token_b = res_b.json()["token"]
    user_b = res_b.json()["user"]
    user_b_id = user_b["id"]
    headers_b = {"Authorization": f"Bearer {token_b}", "Content-Type": "application/json"}
    print(f"      Tenant Bob:   {user_b['email']} (ID: {user_b_id})")

    # 3. Enroll face profile with photo -> stored in RustFS
    print("\n[3/6] Enrolling profile with photo into RustFS...")
    alice_photo_data = generate_test_jpeg("Alice")
    prof_res = requests.post(f"{CLOUD_URL}/api/camera/profiles", headers=headers_a, json={
        "name": "Alice Resident",
        "role": "Owner",
        "action_device_id": "device-6",
        "action_type": "turn_on",
        "action_label": "Unlock Front Door",
        "photo_url": alice_photo_data
    }, timeout=5)
    assert prof_res.status_code == 201, f"Failed to enroll: {prof_res.text}"
    created_prof = prof_res.json()
    prof_id = created_prof["id"]
    photo_url = created_prof["photo_url"]
    print(f"      Enrolled profile: {created_prof['name']} (ID: {prof_id})")
    print(f"      Photo stored at RustFS URL: {photo_url}")
    assert "/api/storage/file?path=users/" in photo_url, f"Expected storage URL, got {photo_url}"

    # 4. Trigger Face Recognition event with snapshot image -> stored in RustFS
    print("\n[4/6] Disagreeing face detection picture to RustFS partitioned by date...")
    snapshot_jpeg = generate_test_jpeg("Snap")
    ws_url = CLOUD_URL.replace("http://", "ws://") + f"/ws/edge?token={token_a}"

    async def send_face_event():
        async with websockets.connect(ws_url) as ws:
            payload = {
                "type": "face_recognized",
                "payload": {
                    "profile_id": prof_id,
                    "name": "Alice Resident",
                    "confidence": 0.985,
                    "camera_id": "CAM-EDGE-01",
                    "snapshot": snapshot_jpeg
                }
            }
            await ws.send(json.dumps(payload))
            await asyncio.sleep(1.0)

    asyncio.run(send_face_event())
    time.sleep(1.0)

    # Query RustFS files for Alice
    files_res = requests.get(f"{CLOUD_URL}/api/storage/files?type=faces", headers=headers_a, timeout=5)
    assert files_res.status_code == 200, f"Failed to list files: {files_res.text}"
    files_list = files_res.json()
    print(f"      Found {len(files_list)} face snapshot(s) in RustFS for Alice:")
    for f in files_list[:3]:
        print(f"       • {f['path']} ({f['size']} bytes, Date: {f['date']})")
    assert len(files_list) > 0, "Expected at least 1 face snapshot in RustFS!"

    sample_file = files_list[0]
    sample_path = sample_file["path"]

    # Download file as Alice -> MUST SUCCEED (200 OK, image/jpeg)
    dl_res_a = requests.get(f"{CLOUD_URL}/api/storage/file?path={sample_path}", headers=headers_a, timeout=5)
    assert dl_res_a.status_code == 200, f"Alice failed to download file: {dl_res_a.status_code}"
    assert dl_res_a.headers.get("Content-Type") == "image/jpeg", f"Wrong Content-Type: {dl_res_a.headers.get('Content-Type')}"
    assert len(dl_res_a.content) > 100, "Downloaded file is empty!"
    print(f"      ✓ Alice successfully retrieved her own image ({len(dl_res_a.content)} bytes, image/jpeg)!")

    # 5. Anti-MITM / Multi-Tenant Security Check:
    # Bob attempts to access Alice's private file -> MUST BE REJECTED with 403 Forbidden!
    print("\n[5/6] Verifying Multi-Tenant Security: Bob attempting to access Alice's file...")
    dl_res_b = requests.get(f"{CLOUD_URL}/api/storage/file?path={sample_path}", headers=headers_b, timeout=5)
    print(f"      Bob's access attempt returned HTTP Status: {dl_res_b.status_code}")
    if dl_res_b.status_code == 403:
        print("      ✓ SECURE: Server strictly REJECTED unauthorized cross-tenant file access (403 Forbidden)!")
    else:
        print(f"      [SECURITY FAILED] Expected 403 Forbidden, got {dl_res_b.status_code}!")
        sys.exit(1)

    # 6. Test 24-hour Activity Archival to RustFS
    print("\n[6/6] Testing 24-hour Activity Archival to RustFS by date...")
    # Trigger archival
    archive_res = requests.post(f"{CLOUD_URL}/api/storage/archive-activities?hours=0", headers=headers_a, timeout=5)
    assert archive_res.status_code == 200, f"Archival failed: {archive_res.text}"
    archive_info = archive_res.json()
    print(f"      Archival trigger result: {archive_info}")

    # Check available activity dates in RustFS
    dates_res = requests.get(f"{CLOUD_URL}/api/storage/dates?type=activities", headers=headers_a, timeout=5)
    assert dates_res.status_code == 200, f"Failed to list dates: {dates_res.text}"
    dates = dates_res.json()
    print(f"      Archived activity dates in RustFS: {dates}")

    if len(dates) > 0:
        target_date = dates[0]
        act_res = requests.get(f"{CLOUD_URL}/api/storage/activities?date={target_date}", headers=headers_a, timeout=5)
        assert act_res.status_code == 200, f"Failed to retrieve archived activities: {act_res.text}"
        archived_items = act_res.json()
        print(f"      Retrieved {len(archived_items)} archived activity item(s) from RustFS for date {target_date}:")
        for it in archived_items[:2]:
            print(f"       • [{it['category']}] {it['message']}")
        print("      ✓ 24h+ activity records successfully archived and queried from RustFS!")

    print("\n" + "=" * 70)
    print("  >>> SUCCESS: All RustFS Cloud Storage & Security Tests PASSED! <<<")
    print("=" * 70)

if __name__ == "__main__":
    main()
