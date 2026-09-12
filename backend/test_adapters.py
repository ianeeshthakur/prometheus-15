import requests
import time
import os
import json

BASE_URL = "http://localhost:8000/api/cameras"

def wait_for_server():
    for _ in range(10):
        try:
            requests.get("http://localhost:8000/")
            return True
        except requests.exceptions.ConnectionError:
            time.sleep(1)
    return False

if not wait_for_server():
    print("Server did not start")
    exit(1)

print("\n--- Pipeline #2 Adapter Tests ---\n")

# Setup: Add mock cameras for each protocol so we can test the factory resolving them
test_cameras = [
    {
        "camera_uid": "CAM-ADAPTER-HLS",
        "name": "HLS Test",
        "department": "IT",
        "district": "Ahmedabad",
        "location": "Server Room",
        "vms_vendor": "Test",
        "protocol_type": "HLS",
        "status": "ACTIVE",
        "ai_enabled": False
    },
    {
        "camera_uid": "CAM-ADAPTER-ONVIF",
        "name": "ONVIF Test",
        "department": "IT",
        "district": "Ahmedabad",
        "location": "Server Room",
        "vms_vendor": "Test",
        "protocol_type": "ONVIF",
        "status": "ACTIVE",
        "ai_enabled": False
    },
    {
        "camera_uid": "CAM-ADAPTER-VENDOR",
        "name": "Vendor Test",
        "department": "IT",
        "district": "Ahmedabad",
        "location": "Server Room",
        "vms_vendor": "Test",
        "protocol_type": "VENDOR_SDK",
        "status": "ACTIVE",
        "ai_enabled": False
    }
]

print("0. Setting up test cameras...")
for cam in test_cameras:
    # Ignore 409 if already exists
    requests.post(f"{BASE_URL}/", json=cam)

print("\n1. Testing HLS Adapter resolution...")
resp = requests.get(f"{BASE_URL}/CAM-ADAPTER-HLS/adapter/health")
print(resp.status_code, resp.json())
assert resp.status_code == 200
assert resp.json()["status"] in ["NOT_CONFIGURED", "OFFLINE"]  # Because rtsp_url/stream_url is empty for our mock

print("\n2. Testing ONVIF Adapter boundary (Unsupported)...")
resp = requests.get(f"{BASE_URL}/CAM-ADAPTER-ONVIF/adapter/health")
print(resp.status_code, resp.json())
assert resp.status_code == 200
assert resp.json()["status"] == "UNSUPPORTED"

print("\n3. Testing Vendor SDK Adapter boundary (Unsupported)...")
resp = requests.get(f"{BASE_URL}/CAM-ADAPTER-VENDOR/adapter/health")
print(resp.status_code, resp.json())
assert resp.status_code == 200
assert resp.json()["status"] == "UNSUPPORTED"

print("\n4. Testing Missing Camera...")
resp = requests.get(f"{BASE_URL}/CAM-DOES-NOT-EXIST/adapter/health")
print(resp.status_code, resp.json())
assert resp.status_code == 404

print("\n5. Testing Sentinel Demo Camera (Legacy Registry Fallback & RTSP Adapter)...")
resp = requests.get(f"{BASE_URL}/CAM-GJ-SRT-00421/adapter/health")
print(resp.status_code, resp.json())
assert resp.status_code == 200
# The legacy camera has an rtsp_url but it's likely offline since Sentinel is mocked
# or if it's reachable, it might be ACTIVE. Let's just check it doesn't crash.
assert resp.json()["status"] in ["OFFLINE", "ERROR", "ACTIVE", "CONNECTING"]
assert "rtsp_url" not in resp.json()

print("\nAll Pipeline #2 adapter boundary tests passed gracefully!")
