# Pipeline 1 (camera registry) tests -- docs/backend.md §5/§8/§12.4/§12.5. Converted
# from the original live-server script to real pytest (TestClient, no manual
# `uvicorn` needed). Auth required on every endpoint here as of §12.5's cleanup.


def test_list_cameras_requires_auth(client):
    resp = client.get("/api/cameras/")
    assert resp.status_code == 401


def test_list_cameras_empty_ok(client, auth_headers):
    resp = client.get("/api/cameras/", headers=auth_headers)
    assert resp.status_code == 200


def test_create_camera(client, auth_headers):
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
    resp = client.post("/api/cameras/", json=cam_data, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["ai_profile"] == "TRAFFIC"  # default, docs/backend.md §12.3
    assert body["onboarding_source"] == "MANUAL"  # docs/backend.md §12.5


def test_create_camera_duplicate_conflicts(client, auth_headers):
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
    resp = client.post("/api/cameras/", json=cam_data, headers=auth_headers)
    assert resp.status_code == 409


def test_json_bulk_import(client, auth_headers):
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
    resp = client.post("/api/cameras/import/json", json=json_data, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["created"] == 2
    assert body["failed"] == 2
    assert len(body["errors"]) == 2
    assert "Missing unique camera identifier" in body["errors"][0]
    assert "Invalid protocol_type" in body["errors"][1]

    resp = client.get("/api/cameras/CAM-TEST-002", headers=auth_headers)
    assert resp.json()["onboarding_source"] == "BULK_JSON"  # docs/backend.md §12.5


def test_json_bulk_import_idempotent(client, auth_headers):
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
    resp = client.post("/api/cameras/import/json", json=json_data, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["duplicates"] == 2


def test_csv_bulk_import(client, auth_headers):
    csv_data = (
        "camera_uid,name,department,district,location,latitude,longitude,vms_vendor,protocol_type,status,ai_enabled\n"
        "CAM-TEST-004,CSV Cam 1,Traffic,Rajkot,Ring Road,22.3039,70.8022,VendorX,RTSP,ACTIVE,true\n"
    )
    files = {"file": ("test.csv", csv_data, "text/csv")}
    resp = client.post("/api/cameras/import/csv", files=files, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["created"] == 1

    resp = client.get("/api/cameras/CAM-TEST-004", headers=auth_headers)
    assert resp.json()["onboarding_source"] == "BULK_CSV"  # docs/backend.md §12.5


def test_gap_analysis_reflects_real_registry(client, auth_headers):
    """docs/backend.md §12.4 -- real query, not mock data."""
    resp = client.get("/api/cameras/gap-analysis", headers=auth_headers)
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


def test_ingest_preview_requires_admin(client):
    resp = client.get("/api/cameras/ingest-preview")
    assert resp.status_code == 401


def test_ingest_preview_fails_clearly_when_unconfigured(client, auth_headers):
    """docs/backend.md §12.7 -- same honesty rule as sync-ingest: no real host is
    configured in this test env, so this must fail clearly, not silently."""
    resp = client.get("/api/cameras/ingest-preview", headers=auth_headers)
    assert resp.status_code == 400
    assert "INGEST_API_BASE_URL" in resp.json()["detail"]


def test_ingest_field_aliases_apply_before_normalization(monkeypatch):
    """docs/backend.md §12.7 -- confirms a real-payload rename (e.g. the catalogue
    uses "vendor" instead of "vms_vendor") is fixable via INGEST_FIELD_ALIASES
    (a config change) rather than needing a code change. Unit-tests the mapping
    function directly -- no network/HTTP involved."""
    import integration.ingest_sync as ingest_sync

    monkeypatch.setattr(ingest_sync, "INGEST_FIELD_ALIASES", {"vendor": "vms_vendor", "cam_id": "camera_uid"})

    raw_item = {
        "cam_id": "CAM-ALIAS-001",
        "name": "Alias Test Camera",
        "district": "Ahmedabad",
        "location": "Test Road",
        "vendor": "AcmeCCTV",
        "status": "active",
        "protocol_type": "RTSP",
    }
    mapped = ingest_sync._map_ingest_fields(raw_item)
    assert mapped["camera_uid"] == "CAM-ALIAS-001"
    assert mapped["vms_vendor"] == "AcmeCCTV"
    # Original keys stay too -- the alias only adds the target key, doesn't rename in place.
    assert mapped["cam_id"] == "CAM-ALIAS-001"


def test_ingest_field_aliases_do_not_override_existing_target_key(monkeypatch):
    """An alias must not clobber a field that's already correctly named in the payload."""
    import integration.ingest_sync as ingest_sync

    monkeypatch.setattr(ingest_sync, "INGEST_FIELD_ALIASES", {"vendor": "vms_vendor"})

    raw_item = {"vendor": "WrongVendor", "vms_vendor": "CorrectVendor"}
    mapped = ingest_sync._map_ingest_fields(raw_item)
    assert mapped["vms_vendor"] == "CorrectVendor"


def test_operator_department_scope_enforced(client):
    """docs/frontend.md §3.7's "role-based search" requirement, closed §12.5 -- an
    OPERATOR only ever sees their own department's cameras, server-side, regardless
    of what `department` filter they pass."""
    admin_login = client.post("/api/auth/login", json={"username": "admin", "password": "test-admin-pass"})
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    resp = client.post(
        "/api/auth/users",
        json={"username": "operator-traffic", "password": "op-pass-123", "role": "OPERATOR", "department_scope": "Traffic"},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text

    op_login = client.post("/api/auth/login", json={"username": "operator-traffic", "password": "op-pass-123"})
    assert op_login.status_code == 200
    op_headers = {"Authorization": f"Bearer {op_login.json()['access_token']}"}

    # Ask for "Security" cameras explicitly -- scope must override the request, not just default.
    resp = client.get("/api/cameras/", params={"department": "Security"}, headers=op_headers)
    assert resp.status_code == 200
    cams = resp.json()["cameras"]
    assert len(cams) > 0
    assert all(c["department"] == "Traffic" for c in cams)

    # A camera outside the operator's scope is a 403 on direct lookup, not a 200 leak.
    resp = client.get("/api/cameras/CAM-TEST-002", headers=op_headers)  # department=Security
    assert resp.status_code == 403
