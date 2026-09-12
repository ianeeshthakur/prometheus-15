# Auth/RBAC + Alerts + Investigations integration tests -- docs/frontend.md §3.3/§3.5,
# docs/backend.md §5 Pipeline 5/§8/§12.4. Converted from the original live-server
# script to real pytest.
#
# test_full_alert_to_investigation_flow is one large test, not several small ones,
# because each step depends on state from the previous one (create camera -> feed a
# matching event -> alert exists -> open investigation from it -> timeline/trace/
# evidence all reference that investigation) -- this mirrors the actual hackathon-day
# vehicle-tracking flow (docs/prd.md §0.1), just against synthetic data since there's
# no real ingest-API camera to test against yet.
import asyncio


def test_login_as_bootstrapped_admin(client):
    resp = client.post("/api/auth/login", json={"username": "admin", "password": "test-admin-pass"})
    assert resp.status_code == 200, resp.text


def test_me_returns_admin_role(client, auth_headers):
    resp = client.get("/api/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["role"] == "ADMIN"


def test_unauthenticated_user_creation_rejected(client):
    resp = client.post("/api/auth/users", json={"username": "x", "password": "y"})
    assert resp.status_code == 401


def test_full_alert_to_investigation_flow(client, auth_headers):
    from intelligence.alert_engine import alert_engine
    from intelligence.events import NormalizedEvent

    # 1. Camera + watchlist entry to trace.
    cam = {
        "camera_uid": "CAM-INV-TEST-001",
        "name": "Investigation Test Camera",
        "department": "Police",
        "district": "Ahmedabad",
        "location": "Test Junction",
        "latitude": 23.02,
        "longitude": 72.57,
        "vms_vendor": "Test",
        "protocol_type": "RTSP",
        "status": "ACTIVE",
        "ai_enabled": True,
    }
    resp = client.post("/api/cameras/", json=cam, headers=auth_headers)
    assert resp.status_code in (201, 409)

    resp = client.post(
        "/api/watchlists/",
        json={"identifier": "GJ11INV0001", "category": "STOLEN_VEHICLE", "risk_level": "CRITICAL"},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text

    # 2. Feed a matching event through the real AlertEngine.
    async def feed_event():
        ev = NormalizedEvent(
            camera_id="CAM-INV-TEST-001",
            event_type="PLATE_RECOGNIZED",
            object_type="VEHICLE",
            confidence=0.93,
            plate_number="GJ11INV0001",
            location="Test Junction",
            district="Ahmedabad",
        )
        await alert_engine.process_event(ev)

    asyncio.run(feed_event())

    # 3. A real, persisted Alert must now exist -- not just a transient SSE broadcast.
    resp = client.get("/api/alerts/", params={"severity": "CRITICAL"}, headers=auth_headers)
    assert resp.status_code == 200
    matches = [a for a in resp.json() if a["entity"] == "GJ11INV0001"]
    assert len(matches) == 1, f"Expected 1 persisted alert, got: {resp.json()}"
    alert = matches[0]
    assert alert["type"] == "WATCHLIST_MATCH"
    assert alert["camera_name"] == "Investigation Test Camera"
    assert alert["district"] == "Ahmedabad"
    assert alert["status"] == "NEW"

    # 4. Acknowledge it.
    resp = client.patch(f"/api/alerts/{alert['alert_uid']}/status", json={"status": "ACKNOWLEDGED"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ACKNOWLEDGED"

    # 5. Open an investigation from the alert.
    resp = client.post(f"/api/alerts/{alert['alert_uid']}/investigation", headers=auth_headers)
    assert resp.status_code == 201, resp.text
    case = resp.json()
    assert case["entity"] == "GJ11INV0001"
    assert case["priority"] == "HIGH"
    case_uid = case["case_uid"]

    # 6. The alert now links back to the investigation.
    resp = client.get(f"/api/alerts/{alert['alert_uid']}", headers=auth_headers)
    assert resp.json()["investigation_id"] == case["id"]

    # 7. Timeline includes both the event and the alert.
    resp = client.get(f"/api/investigations/{case_uid}/timeline", headers=auth_headers)
    assert resp.status_code == 200
    timeline = resp.json()
    assert any(e["identifier"] == "GJ11INV0001" for e in timeline["events"])
    assert any(a["entity"] == "GJ11INV0001" for a in timeline["alerts"])

    # 8. Map trace -- the graded vehicle-tracking test's shape (docs/prd.md §0.1).
    resp = client.get(f"/api/investigations/{case_uid}/trace", headers=auth_headers)
    assert resp.status_code == 200
    trace = resp.json()
    assert trace["entity"] == "GJ11INV0001"
    assert len(trace["sightings"]) == 1
    sighting = trace["sightings"][0]
    assert sighting["camera_uid"] == "CAM-INV-TEST-001"
    assert sighting["district"] == "Ahmedabad"
    assert sighting["latitude"] == 23.02

    # 9. Evidence CRUD.
    resp = client.post(
        f"/api/investigations/{case_uid}/evidence",
        json={"evidence_type": "PLATE_READ", "description": "ANPR match", "camera_uid": "CAM-INV-TEST-001", "confidence": 0.93},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    resp = client.get(f"/api/investigations/{case_uid}/evidence", headers=auth_headers)
    assert len(resp.json()) == 1
