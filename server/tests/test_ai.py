# Pipeline 3 (AI orchestrator) tests -- docs/ai_pipelines.md §1/§3, docs/backend.md
# §8/§12.4. Converted from the original live-server script to real pytest.


def test_ai_health(client):
    resp = client.get("/api/ai/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "READY"
    assert data["providers"]["vehicle"] == "MOCK_READY"
    # Real as of the OCR/anomaly build-out -- see ai/real_providers.py.
    assert data["providers"]["plate"] == "REAL_READY"
    assert data["providers"]["anomaly"] == "REAL_READY"


def test_ai_config(client):
    resp = client.get("/api/ai/config")
    assert resp.status_code == 200
    assert "TRAFFIC" in resp.json()["profiles"]


def test_orchestrator_traffic_profile(client):
    """plate_detector/ocr_provider are real as of the OCR build-out (ai/real_providers.py),
    so unlike the old mock a fixed plate count can't be asserted against a random-noise
    test frame -- a real Haar cascade has no reason to find a plate-shaped region in
    noise. Assert the real, deterministic parts: mock vehicle detection still fires,
    and plates (if any survive the confidence threshold) come back well-typed."""
    req = {"camera_uid": "TEST-CAM-1", "profile": "TRAFFIC", "width": 1920, "height": 1080, "source_protocol": "MOCK"}
    resp = client.post("/api/ai/analyze-frame", json=req)
    assert resp.status_code == 200
    data = resp.json()
    assert data["camera_uid"] == "TEST-CAM-1"
    assert len(data["vehicles"]) == 1
    assert len(data["persons"]) == 0
    assert isinstance(data["plates"], list)
    for plate in data["plates"]:
        assert plate["status"] in ("READABLE", "LOW_CONFIDENCE", "UNREADABLE")
    assert data["frame_quality"] == "GOOD"
    assert data["model_versions"]["plate_detection"].startswith("REAL:")


def test_orchestrator_security_profile(client):
    """anomaly_detector is real (classical MOG2 background subtraction,
    ai/real_providers.py) and deliberately reports nothing for a camera's first ~20
    analyzed frames while the background model warms up -- this is a single isolated
    call, so frames_seen==1 and zero anomalies is the one deterministic, correct
    real-detector outcome here (a fixed mock anomaly every call would be the dishonest
    result now)."""
    req = {"camera_uid": "TEST-CAM-SECURITY-WARMUP", "profile": "SECURITY", "width": 1920, "height": 1080, "source_protocol": "MOCK"}
    resp = client.post("/api/ai/analyze-frame", json=req)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["vehicles"]) == 0
    assert len(data["plates"]) == 0
    assert len(data["persons"]) == 1
    assert len(data["anomalies"]) == 0
    assert data["model_versions"]["anomaly_detection"].startswith("REAL:")


def test_orchestrator_invalid_profile_rejected(client):
    req = {"camera_uid": "TEST-CAM-1", "profile": "INVALID", "width": 1920, "height": 1080, "source_protocol": "MOCK"}
    resp = client.post("/api/ai/analyze-frame", json=req)
    assert resp.status_code == 422  # Pydantic enum validation catches this
