# Alert table: severity, status, entity refs, investigation link -- docs/backend.md §5
# Pipeline 5. Built during the docs/backend.md §12.4 build-out to close the "alerts
# broadcast live via SSE but never persisted" gap.
#
# Deliberately normalized (camera_uid FK, not a denormalized camera_name/district copy)
# -- schemas/alert.py's response schema joins to Camera when building the frontend-
# facing shape (lib/types.ts Alert is denormalized/flat; that's a display concern, not
# a storage concern).
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.sql import func

from db.base import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    alert_uid = Column(String, unique=True, index=True, nullable=False)  # e.g. ALT-EVT-XXXXXXXX
    severity = Column(String, nullable=False)  # CRITICAL/HIGH/MEDIUM/LOW/INFO
    type = Column(String, nullable=False)  # ANPR_MATCH/WATCHLIST_MATCH/ANOMALY/PERSON_MATCH
    description = Column(String, nullable=False)
    entity = Column(String, nullable=False)  # plate text / person id / description
    camera_uid = Column(String, ForeignKey("cameras.camera_uid"), nullable=False, index=True)
    status = Column(String, nullable=False, default="NEW")  # NEW/ACKNOWLEDGED/ESCALATED/RESOLVED
    confidence = Column(Float, nullable=False)
    watchlist_entry_id = Column(Integer, ForeignKey("watchlist_entries.id"), nullable=True)
    investigation_id = Column(Integer, ForeignKey("investigations.id"), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
