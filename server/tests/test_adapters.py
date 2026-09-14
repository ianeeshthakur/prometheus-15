# Pipeline 2 (adapter factory) tests -- docs/backend.md §3/§8/§12.4/§12.5. Converted
# from the original live-server script to real pytest. Auth required on the health
# endpoint as of §12.5's cleanup (it opens a real network connection to the camera).
import pytest


@pytest.fixture(scope="module", autouse=True)
def _seed_test_cameras(client, admin_token):
    # Can't depend on the function-scoped `auth_headers` fixture from a module-scoped
    # one -- build headers directly from the session-scoped `admin_token` instead.
    auth_headers = {"Authorization": f"Bearer {admin_token}"}
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
    for cam in test_cameras:
        client.post("/api/cameras/", json=cam, headers=auth_headers)  # ignore 409 if already exists


def test_adapter_health_requires_auth(client):
    resp = client.get("/api/cameras/CAM-ADAPTER-HLS/adapter/health")
    assert resp.status_code == 401


def test_hls_adapter_not_configured_without_stream_url(client, auth_headers):
    resp = client.get("/api/cameras/CAM-ADAPTER-HLS/adapter/health", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] in ["NOT_CONFIGURED", "OFFLINE"]


def test_onvif_adapter_boundary_unsupported(client, auth_headers):
    resp = client.get("/api/cameras/CAM-ADAPTER-ONVIF/adapter/health", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "UNSUPPORTED"


def test_vendor_sdk_adapter_boundary_unsupported(client, auth_headers):
    resp = client.get("/api/cameras/CAM-ADAPTER-VENDOR/adapter/health", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "UNSUPPORTED"


def test_missing_camera_returns_404(client, auth_headers):
    resp = client.get("/api/cameras/CAM-DOES-NOT-EXIST/adapter/health", headers=auth_headers)
    assert resp.status_code == 404
