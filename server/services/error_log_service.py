# Structured adapter/stream error log -- docs/backend.md §2's checklist item, closed
# 2026-09-14. Everything that used to be a plain `logger.error()` call in
# adapters/rtsp.py, adapters/hls.py, and video/ffmpeg_runner.py now also writes a real,
# queryable row here via log_adapter_error(); logger calls stay too (this doesn't
# replace real-time ops logging, it adds the structured, persisted, filterable half
# that was actually missing).
import re
from typing import Optional
from sqlalchemy.orm import Session

from models.event import AdapterErrorLog


def redact_stream_url(url: Optional[str]) -> Optional[str]:
    """Strips credentials out of an rtsp://user:pass@host:port/path URL before it's
    ever written to the DB or logged -- same boundary schemas/camera.py's
    CameraResponse already enforces for the registry (no raw camera IP/RTSP URL ever
    reaches a frontend-facing response). Host/path are kept; they're what an engineer
    actually needs to debug a specific camera's connection, and neither one is a
    working credential on its own. Handles rtsp://, rtsps://, and http(s):// (HLS
    manifest URLs can carry query-string tokens too -- those are stripped generically,
    not just the userinfo@ form)."""
    if not url:
        return url
    # userinfo@ form: rtsp://user:pass@host:port/path -> rtsp://[REDACTED]@host:port/path
    redacted = re.sub(r"^(\w+://)[^@/]+@", r"\1[REDACTED]@", url)
    # query string (HLS/WHEP tokens, signed URLs, etc.) -> path?[REDACTED]
    redacted = re.sub(r"\?.*$", "?[REDACTED]", redacted)
    return redacted


def log_adapter_error(
    db: Session,
    error_type: str,
    source: str = "BACKEND_ADAPTER",
    camera_uid: Optional[str] = None,
    url: Optional[str] = None,
    client_name: Optional[str] = None,
    client_version: Optional[str] = None,
    error_message: Optional[str] = None,
) -> AdapterErrorLog:
    entry = AdapterErrorLog(
        camera_uid=camera_uid,
        source=source,
        url_redacted=redact_stream_url(url),
        client_name=client_name,
        client_version=client_version,
        error_type=error_type,
        error_message=error_message[:2000] if error_message else None,  # cap -- ffmpeg stderr can be long
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def list_adapter_errors(db: Session, camera_uid: Optional[str] = None, limit: int = 100):
    query = db.query(AdapterErrorLog)
    if camera_uid:
        query = query.filter(AdapterErrorLog.camera_uid == camera_uid)
    return query.order_by(AdapterErrorLog.created_at.desc()).limit(limit).all()


def log_adapter_error_now(
    error_type: str,
    camera_uid: Optional[str] = None,
    url: Optional[str] = None,
    client_name: Optional[str] = None,
    client_version: Optional[str] = None,
    error_message: Optional[str] = None,
) -> None:
    """Convenience wrapper for call sites that don't already have a DB session --
    adapters/rtsp.py and adapters/hls.py's connect()/_attempt_reconnect() are plain
    sync methods with no session threaded through them (they're invoked via
    asyncio.to_thread from routers/streams.py, several layers away from any request's
    `Depends(get_db)`). Opens and closes its own session, same pattern
    routers/streams.py's own _run_ai_pipeline already uses for the same reason.
    Swallows its own DB errors (logs them) rather than letting a logging failure
    take down the actual adapter error path it's trying to record."""
    from db.database import SessionLocal

    db = SessionLocal()
    try:
        log_adapter_error(
            db,
            error_type=error_type,
            camera_uid=camera_uid,
            url=url,
            client_name=client_name,
            client_version=client_version,
            error_message=error_message,
        )
    except Exception:
        import logging

        logging.getLogger(__name__).exception("Failed to write adapter error log row")
    finally:
        db.close()


def opencv_version() -> str:
    """Real, detected version -- never a guessed/hardcoded string. Returns "unknown"
    if cv2 genuinely can't be imported, which is itself an honest, meaningful answer
    (something adapters/rtsp.py and hls.py already depend on hard-failing without)."""
    try:
        import cv2

        return cv2.__version__
    except Exception:
        return "unknown"


def ffmpeg_version() -> str:
    """Real, detected version via `ffmpeg -version`'s first line -- never guessed.
    Returns "not installed" (a real, honest answer, matching GET /api/health/'s own
    ffmpeg_available flag) rather than a hardcoded version string when ffmpeg isn't on
    PATH, which is the actual state of this dev sandbox."""
    import subprocess

    try:
        result = subprocess.run(
            ["ffmpeg", "-version"], capture_output=True, text=True, timeout=5
        )
        first_line = result.stdout.splitlines()[0] if result.stdout else ""
        # "ffmpeg version 6.1.1 Copyright ..." -> "6.1.1"
        match = re.search(r"ffmpeg version (\S+)", first_line)
        return match.group(1) if match else first_line.strip() or "unknown"
    except (FileNotFoundError, subprocess.TimeoutExpired, IndexError):
        return "not installed"
