import requests
import time

BASE_URL = "http://localhost:8000/api/ai"

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

print("\n--- Pipeline #3 AI Analytics Tests ---\n")

print("1. Testing AI Health Endpoint...")
resp = requests.get(f"{BASE_URL}/health")
assert resp.status_code == 200
data = resp.json()
assert data["status"] == "READY"
assert data["providers"]["vehicle"] == "MOCK_READY"
print("   PASS")

print("2. Testing AI Config Endpoint...")
resp = requests.get(f"{BASE_URL}/config")
assert resp.status_code == 200
data = resp.json()
assert "TRAFFIC" in data["profiles"]
print("   PASS")

print("3. Testing AI Orchestrator (TRAFFIC Profile)...")
req = {
    "camera_uid": "TEST-CAM-1",
    "profile": "TRAFFIC",
    "width": 1920,
    "height": 1080,
    "source_protocol": "MOCK"
}
resp = requests.post(f"{BASE_URL}/analyze-frame", json=req)
assert resp.status_code == 200
data = resp.json()
assert data["camera_uid"] == "TEST-CAM-1"
assert len(data["vehicles"]) == 1
assert len(data["plates"]) == 1
assert len(data["persons"]) == 0
assert data["plates"][0]["status"] == "READABLE"
assert data["frame_quality"] == "GOOD"
print("   PASS")

print("4. Testing AI Orchestrator (SECURITY Profile)...")
req["profile"] = "SECURITY"
resp = requests.post(f"{BASE_URL}/analyze-frame", json=req)
assert resp.status_code == 200
data = resp.json()
assert len(data["vehicles"]) == 0
assert len(data["plates"]) == 0
assert len(data["persons"]) == 1
assert len(data["anomalies"]) == 1
print("   PASS")

print("5. Testing AI Orchestrator (Invalid Profile)...")
req["profile"] = "INVALID"
resp = requests.post(f"{BASE_URL}/analyze-frame", json=req)
assert resp.status_code == 422 # Pydantic enum validation catches this
print("   PASS")

print("\nAll Pipeline #3 tests passed gracefully!")
