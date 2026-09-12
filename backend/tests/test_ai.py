# Pipeline 3 (AI orchestrator) tests -- docs/ai_pipelines.md §1/§3, docs/backend.md
# §8/§12.4. Converted from the original live-server script to real pytest.


def test_ai_health(client):
    resp = client.get("/api/ai/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "READY"
    assert data["providers"]["vehicle"] == "MOCK_READY"


def test_ai_config(client):
    resp = client.get("/api/ai/config")
    assert resp.status_code == 200
    assert "TRAFFIC" in resp.json()["profiles"]


def test_orchestrator_traffic_profile(client):
    req = {"camera_uid": "TEST-CAM-1", "profile": "TRAFFIC", "width": 1920, "height": 1080, "source_protocol": "MOCK"}
    resp = client.post("/api/ai/analyze-frame", json=req)
    assert resp.status_code == 200
    data = resp.json()
    assert data["camera_uid"] == "TEST-CAM-1"
    assert len(data["vehicles"]) == 1
    assert len(data["plates"]) == 1
    assert len(data["persons"]) == 0
    assert data["plates"][0]["status"] == "READABLE"
    assert data["frame_quality"] == "GOOD"


def test_orchestrator_security_profile(client):
    req = {"camera_uid": "TEST-CAM-1", "profile": "SECURITY", "width": 1920, "height": 1080, "source_protocol": "MOCK"}
    resp = client.post("/api/ai/analyze-frame", json=req)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["vehicles"]) == 0
    assert len(data["plates"]) == 0
    assert len(data["persons"]) == 1
    assert len(data["anomalies"]) == 1


def test_orchestrator_invalid_profile_rejected(client):
    req = {"camera_uid": "TEST-CAM-1", "profile": "INVALID", "width": 1920, "height": 1080, "source_protocol": "MOCK"}
    resp = client.post("/api/ai/analyze-frame", json=req)
    assert resp.status_code == 422  # Pydantic enum validation catches this
