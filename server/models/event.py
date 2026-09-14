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
