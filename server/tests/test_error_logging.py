# Structured adapter/error reporting -- docs/backend.md §2's checklist item, closed
# 2026-09-14 (services/error_log_service.py, models/event.py's AdapterErrorLog).
# Previously just plain logger.error() calls with nothing queryable or persisted.


def test_redact_stream_url_strips_credentials():
    from services.error_log_service import redact_stream_url

    redacted = redact_stream_url("rtsp://admin:s3cret@10.0.0.5:554/stream1")
    assert "s3cret" not in redacted
    assert "admin" not in redacted
    assert "10.0.0.5:554/stream1" in redacted  # host/path kept -- real debugging value


def test_redact_stream_url_strips_query_string_tokens():
    from services.error_log_service import redact_stream_url

    redacted = redact_stream_url("https://cdn.example.com/hls/index.m3u8?token=abc123secret")
    assert "abc123secret" not in redacted
    assert "https://cdn.example.com/hls/index.m3u8" in redacted


def test_redact_stream_url_handles_none_and_no_credentials():
    from services.error_log_service import redact_stream_url

    assert redact_stream_url(None) is None
    assert redact_stream_url("rtsp://10.0.0.5:554/stream1") == "rtsp://10.0.0.5:554/stream1"


def test_log_adapter_error_persists_a_real_row(client, auth_headers):
    from db.database import SessionLocal
    from services.error_log_service import log_adapter_error

    db = SessionLocal()
    try:
        entry = log_adapter_error(
            db,
            error_type="CONNECTION_FAILED",
            camera_uid="CAM-ERRTEST-001",
            url="rtsp://admin:pw@10.0.0.9:554/x",
            client_name="opencv-rtsp",
            client_version="4.10.0",
            error_message="Simulated failure for a real test",
        )
        assert entry.id is not None
        assert "pw" not in entry.url_redacted
    finally:
        db.close()

    resp = client.get("/api/admin/adapter-errors?camera_uid=CAM-ERRTEST-001", headers=auth_headers)
    assert resp.status_code == 200
    entries = resp.json()["entries"]
    assert len(entries) == 1
    assert entries[0]["error_type"] == "CONNECTION_FAILED"
    assert entries[0]["source"] == "BACKEND_ADAPTER"
    assert "pw" not in entries[0]["url_redacted"]
    # Caught while building this endpoint: /api/admin/audit-log had the same bug --
    # returning raw ORM objects (`{"entries": entries}`, no response_model) bypasses
    # schemas/common.py's UtcDatetime entirely, reproducing the exact "timestamps
    # silently off by the server's UTC offset" bug already fixed elsewhere (commit
    # ced635d). A timestamp with no timezone suffix at all is the tell.
    assert entries[0]["created_at"].endswith("Z")


def test_audit_log_timestamps_carry_a_utc_suffix(client, auth_headers):
    resp = client.get("/api/admin/audit-log?limit=1", headers=auth_headers)
    assert resp.status_code == 200
    entries = resp.json()["entries"]
    assert len(entries) >= 1
    assert entries[0]["created_at"].endswith("Z")


def test_adapter_errors_endpoint_requires_admin(client, auth_headers):
    resp = client.get("/api/admin/adapter-errors")
    assert resp.status_code == 401


def test_client_error_report_requires_auth(client):
    resp = client.post(
        "/api/streams/client-errors",
        json={
            "camera_uid": "CAM-ERRTEST-002",
            "client_name": "browser-hls.js",
            "client_version": "1.7.3",
            "error_type": "PLAYBACK_ERROR",
            "error_message": "networkError: fragLoadError",
        },
    )
    assert resp.status_code == 401


def test_client_error_report_writes_a_real_row(client, auth_headers):
    resp = client.post(
        "/api/streams/client-errors",
        headers=auth_headers,
        json={
            "camera_uid": "CAM-ERRTEST-002",
            "client_name": "browser-hls.js",
            "client_version": "1.7.3",
            "error_type": "PLAYBACK_ERROR",
            "error_message": "networkError: fragLoadError",
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "logged"

    listing = client.get("/api/admin/adapter-errors?camera_uid=CAM-ERRTEST-002", headers=auth_headers)
    entries = listing.json()["entries"]
    assert len(entries) == 1
    assert entries[0]["source"] == "CLIENT"
    assert entries[0]["client_name"] == "browser-hls.js"
    assert entries[0]["error_message"] == "networkError: fragLoadError"


def test_opencv_version_is_real_not_hardcoded():
    """cv2 is a real installed dependency here (opencv-python-headless) -- this must
    return its actual __version__, not a guessed string."""
    import cv2
    from services.error_log_service import opencv_version

    assert opencv_version() == cv2.__version__


def test_ffmpeg_version_is_real_not_hardcoded():
    """Checks against shutil.which() (the actual environment state) rather than
    hardcoding "not installed" -- this dev sandbox has no ffmpeg on PATH (GET
    /api/health/'s own ffmpeg_available flag confirms it), but the test itself must
    stay correct wherever it runs, not just where it was written."""
    import shutil

    from services.error_log_service import ffmpeg_version

    if shutil.which("ffmpeg") is None:
        assert ffmpeg_version() == "not installed"
    else:
        version = ffmpeg_version()
        assert version not in (None, "", "unknown")
