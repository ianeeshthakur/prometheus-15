import requests
import time
import json
import os

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

print("1. Testing GET /api/cameras/")
resp = requests.get(f"{BASE_URL}/")
print(resp.status_code, resp.json())
assert "CAM-GJ-SRT-00421" in str(resp.json()), "Sentinel camera missing!"

print("2. Testing POST /api/cameras/")
cam_data = {
    "camera_uid": "CAM-TEST-001",
    "name": "Test Camera",
    "department": "Traffic",
    "district": "Ahmedabad",
    "location": "SG Highway",
    "vms_vendor": "TestVendor",
    "protocol_type": "RTSP",
    "status": "ACTIVE",
    "ai_enabled": True
}
resp = requests.post(f"{BASE_URL}/", json=cam_data)
print(resp.status_code, resp.json())
assert resp.status_code == 201

print("3. Testing POST /api/cameras/ duplicate")
resp = requests.post(f"{BASE_URL}/", json=cam_data)
print(resp.status_code, resp.json())
assert resp.status_code == 409

print("4. Testing JSON bulk import")
json_data = [
    {
        "id": "CAM-TEST-002",
        "name": "Bulk Cam 1",
        "department": "Security",
        "district": "Surat",
        "location": "North Gate",
        "vms_vendor": "TestVendor",
        "protocol_type": "HLS",
        "status": "active",
        "latitude": 21.1702,
        "longitude": 72.8311
    },
    {
        "id": "CAM-TEST-003",
        "name": "Bulk Cam 2",
        "department": "Security",
        "district": "Surat",
        "location": "South Gate",
        "vms_vendor": "TestVendor",
        "protocol_type": "ONVIF",
        "status": "degraded"
    },
    {
        # Missing ID
        "name": "Bulk Cam 3",
        "department": "Security",
        "district": "Surat",
        "location": "East Gate",
        "vms_vendor": "TestVendor",
        "protocol_type": "ONVIF",
        "status": "active"
    },
    {
        # Invalid Protocol
        "id": "CAM-TEST-005",
        "name": "Bulk Cam 5",
        "department": "Security",
        "district": "Surat",
        "location": "West Gate",
        "vms_vendor": "TestVendor",
        "protocol_type": "INVALID_PROTO",
        "status": "active"
    }
]
resp = requests.post(f"{BASE_URL}/import/json", json=json_data)
print(resp.status_code, resp.json())
assert resp.status_code == 200
assert resp.json()["created"] == 2
assert resp.json()["failed"] == 2
assert len(resp.json()["errors"]) == 2
assert "Missing unique camera identifier" in resp.json()["errors"][0]
assert "Invalid protocol_type" in resp.json()["errors"][1]

print("5. Testing JSON bulk import duplicate (idempotency)")
# Test only the valid ones for idempotency
json_data_valid = [json_data[0], json_data[1]]
resp = requests.post(f"{BASE_URL}/import/json", json=json_data_valid)
print(resp.status_code, resp.json())
assert resp.status_code == 200
assert resp.json()["duplicates"] == 2

print("6. Testing CSV bulk import")
csv_data = "camera_uid,name,department,district,location,latitude,longitude,vms_vendor,protocol_type,status,ai_enabled\nCAM-TEST-004,CSV Cam 1,Traffic,Rajkot,Ring Road,22.3039,70.8022,VendorX,RTSP,ACTIVE,true\n"
files = {'file': ('test.csv', csv_data, 'text/csv')}
resp = requests.post(f"{BASE_URL}/import/csv", files=files)
print(resp.status_code, resp.json())
assert resp.status_code == 200
assert resp.json()["created"] == 1

print("All tests passed successfully!")
