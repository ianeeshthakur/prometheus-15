# Live-server integration test for Pipeline 2 (adapter factory). Run with the backend
# already up (`uvicorn main:app`). Ported from contrib/aneesh/backend/test_adapters.py --
# test #5 (legacy "Sentinel Demo Camera" registry fallback) removed since camera_registry
# was not ported (see adapters/factory.py's docstring).
import requests
import time

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
        "ai_enabled": False,
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
        "ai_enabled": False,
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
        "ai_enabled": False,
    },
]

print("0. Setting up test cameras...")
for cam in test_cameras:
    requests.post(f"{BASE_URL}/", json=cam)  # ignore 409 if already exists

print("\n1. Testing HLS Adapter resolution...")
resp = requests.get(f"{BASE_URL}/CAM-ADAPTER-HLS/adapter/health")
print(resp.status_code, resp.json())
assert resp.status_code == 200
assert resp.json()["status"] in ["NOT_CONFIGURED", "OFFLINE"]  # empty rtsp_url for this mock camera

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

print("\nAll Pipeline #2 adapter boundary tests passed gracefully!")
