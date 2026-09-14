# CameraEvent table -- the persisted form of intelligence/events.py's NormalizedEvent
# (docs/ai_pipelines.md §3, docs/backend.md §5 Pipeline 5). Built during the
# docs/backend.md §12.4 build-out to close the "events broadcast live via SSE but never
# written to a DB table" gap -- see intelligence/alert_engine.py, which now persists
# every event here in addition to broadcasting it.
#
# Mirrors frontend's CameraEvent shape (lib/types.ts) closely by design.
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.sql import func

from db.base import Base


class CameraEvent(Base):
    __tablename__ = "camera_events"

    id = Column(Integer, primary_key=True, index=True)
    event_uid = Column(String, unique=True, index=True, nullable=False)  # matches NormalizedEvent.event_id format
    camera_uid = Column(String, ForeignKey("cameras.camera_uid"), nullable=False, index=True)
    event_type = Column(String, nullable=False)  # e.g. PLATE_RECOGNIZED, PERSON_DETECTED, ANOMALY_WRONG_WAY
    object_type = Column(String, nullable=True)  # VEHICLE, PERSON, ANOMALY
    # Normalized identifier this event carries, when it has one -- a plate's
    # normalized_text (docs/ai_pipelines.md §2) today; a stable person/vehicle
    # identifier once re-identification exists (docs/ai_pipelines.md §5). This is the
    # column intelligence/entity_graph.py's cross-camera trace groups by.
    identifier = Column(String, nullable=True, index=True)
    confidence = Column(Float, nullable=False)
    location = Column(String, nullable=True)
    district = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class AdapterErrorLog(Base):
    """Structured adapter/stream error log -- closes docs/backend.md §2's checklist
    item ("error reporting capturing camera id, exact URL, client + version, UTC
    timestamp, and client-side error log"), which was previously just plain Python
    `logger.error()` calls with nothing queryable or persisted.

    `url_redacted` deliberately never stores real credentials -- same boundary
    CameraResponse already enforces for the registry (its own docstring: no raw
    camera IP/RTSP URL ever reaches a frontend-facing response). An engineer with DB
    access still gets host/path for debugging; a leaked row (DB dump, admin-log view)
    can't leak a working camera password. See services/error_log_service.py's
    redact_stream_url() for the actual redaction.

    `source` distinguishes a real backend adapter failure (RTSP/HLS/FFmpeg connect or
    read failure) from a real frontend-reported failure (e.g. HlsPlayer.jsx's video
    element firing a real playback error) -- both write to this same table via
    services/error_log_service.py, so an engineer sees the whole picture in one place
    instead of two disconnected logs."""

    __tablename__ = "adapter_error_log"

    id = Column(Integer, primary_key=True, index=True)
    camera_uid = Column(String, ForeignKey("cameras.camera_uid"), nullable=True, index=True)
    source = Column(String, nullable=False)  # BACKEND_ADAPTER | CLIENT
    url_redacted = Column(String, nullable=True)  # e.g. rtsp://[REDACTED]@host:port/path -- never raw credentials
    client_name = Column(String, nullable=True)  # e.g. opencv-rtsp, opencv-hls, ffmpeg, browser-hls.js
    client_version = Column(String, nullable=True)  # real, detected version -- "unknown" if it genuinely can't be determined, never guessed
    error_type = Column(String, nullable=False)  # e.g. CONNECTION_FAILED, READ_FAILED, PROBE_FAILED, PLAYBACK_ERROR
    error_message = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)  # UTC timestamp, per the checklist item
