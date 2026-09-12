# Pipeline 1 (camera registry) tests -- docs/backend.md §5/§8/§12.4. Converted from
# the original live-server script to real pytest (TestClient, no manual `uvicorn` needed).


def test_list_cameras_empty_ok(client):
    resp = client.get("/api/cameras/")
    assert resp.status_code == 200


def test_create_camera(client):
    cam_data = {
        "camera_uid": "CAM-TEST-001",
        "name": "Test Camera",
        "department": "Traffic",
        "district": "Ahmedabad",
        "location": "SG Highway",
        "vms_vendor": "TestVendor",
        "protocol_type": "RTSP",
        "status": "ACTIVE",
        "ai_enabled": True,
    }
    resp = client.post("/api/cameras/", json=cam_data)
    assert resp.status_code == 201, resp.text
    assert resp.json()["ai_profile"] == "TRAFFIC"  # default, docs/backend.md §12.3


def test_create_camera_duplicate_conflicts(client):
    cam_data = {
        "camera_uid": "CAM-TEST-001",  # same UID as test_create_camera
        "name": "Test Camera",
        "department": "Traffic",
        "district": "Ahmedabad",
        "location": "SG Highway",
        "vms_vendor": "TestVendor",
        "protocol_type": "RTSP",
        "status": "ACTIVE",
        "ai_enabled": True,
    }
    resp = client.post("/api/cameras/", json=cam_data)
    assert resp.status_code == 409


def test_json_bulk_import(client):
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
            "longitude": 72.8311,
        },
        {
            "id": "CAM-TEST-003",
            "name": "Bulk Cam 2",
            "department": "Security",
            "district": "Surat",
            "location": "South Gate",
            "vms_vendor": "TestVendor",
            "protocol_type": "ONVIF",
            "status": "degraded",
        },
        {  # Missing ID
            "name": "Bulk Cam 3",
            "department": "Security",
            "district": "Surat",
            "location": "East Gate",
            "vms_vendor": "TestVendor",
            "protocol_type": "ONVIF",
            "status": "active",
        },
        {  # Invalid protocol
            "id": "CAM-TEST-005",
            "name": "Bulk Cam 5",
            "department": "Security",
            "district": "Surat",
            "location": "West Gate",
            "vms_vendor": "TestVendor",
            "protocol_type": "INVALID_PROTO",
            "status": "active",
        },
    ]
    resp = client.post("/api/cameras/import/json", json=json_data)
    assert resp.status_code == 200
    body = resp.json()
    assert body["created"] == 2
    assert body["failed"] == 2
    assert len(body["errors"]) == 2
    assert "Missing unique camera identifier" in body["errors"][0]
    assert "Invalid protocol_type" in body["errors"][1]


def test_json_bulk_import_idempotent(client):
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
        },
        {
            "id": "CAM-TEST-003",
            "name": "Bulk Cam 2",
            "department": "Security",
            "district": "Surat",
            "location": "South Gate",
            "vms_vendor": "TestVendor",
            "protocol_type": "ONVIF",
            "status": "degraded",
        },
    ]
    resp = client.post("/api/cameras/import/json", json=json_data)
    assert resp.status_code == 200
    assert resp.json()["duplicates"] == 2


def test_csv_bulk_import(client):
    csv_data = (
        "camera_uid,name,department,district,location,latitude,longitude,vms_vendor,protocol_type,status,ai_enabled\n"
        "CAM-TEST-004,CSV Cam 1,Traffic,Rajkot,Ring Road,22.3039,70.8022,VendorX,RTSP,ACTIVE,true\n"
    )
    files = {"file": ("test.csv", csv_data, "text/csv")}
    resp = client.post("/api/cameras/import/csv", files=files)
    assert resp.status_code == 200
    assert resp.json()["created"] == 1


def test_gap_analysis_reflects_real_registry(client):
    """docs/backend.md §12.4 -- real query, not mock data."""
    resp = client.get("/api/cameras/gap-analysis")
    assert resp.status_code == 200
    gaps = resp.json()["gaps"]
    # Every district/department combo above has well under the expected_minimum=3
    # default, so at least one shortfall row must exist.
    assert len(gaps) > 0
    assert all(g["shortfall"] > 0 for g in gaps)


def test_sync_ingest_requires_admin(client):
    resp = client.post("/api/cameras/sync-ingest")
    assert resp.status_code == 401


def test_sync_ingest_fails_clearly_when_unconfigured(client, auth_headers):
    """docs/backend.md §2/§12.4 -- INGEST_API_BASE_URL is unset in this test env;
    confirms a clear 400, not a silent no-op or a crash."""
    resp = client.post("/api/cameras/sync-ingest", headers=auth_headers)
    assert resp.status_code == 400
    assert "INGEST_API_BASE_URL" in resp.json()["detail"]
