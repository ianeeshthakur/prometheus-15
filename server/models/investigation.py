# Investigation, TimelineEvent(-equivalent), EvidenceItem tables -- docs/frontend.md
# §3.5, docs/backend.md §5 Pipeline 5. Built during the docs/backend.md §12.4
# build-out; no frontend type existed to mirror (the Investigations page was still a
# placeholder when this was written), so this follows frontend.md §3.5's textual spec:
# case header (title, status, priority, assigned officer) + Timeline/Evidence/Related
# entities/Map trace tabs.
#
# Timeline and Map trace are NOT separate tables -- they're both derived by querying
# CameraEvent (models/event.py) and Alert (models/alert.py) rows matching the
# investigation's `entity` identifier, via intelligence/entity_graph.py. Only Evidence
# is its own table, since evidence is explicitly curated (attached), not just
# "everything that happened to match."
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.sql import func

from db.base import Base


class Investigation(Base):
    __tablename__ = "investigations"

    id = Column(Integer, primary_key=True, index=True)
    case_uid = Column(String, unique=True, index=True, nullable=False)  # e.g. INV-00001
    title = Column(String, nullable=False)
    entity = Column(String, nullable=False, index=True)  # normalized plate/identifier this case traces
    status = Column(String, nullable=False, default="OPEN")  # OPEN/CLOSED
    priority = Column(String, nullable=False, default="MEDIUM")  # HIGH/MEDIUM/LOW
    assigned_officer = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class InvestigationEvidence(Base):
    __tablename__ = "investigation_evidence"

    id = Column(Integer, primary_key=True, index=True)
    investigation_id = Column(Integer, ForeignKey("investigations.id"), nullable=False, index=True)
    evidence_type = Column(String, nullable=False)  # SNAPSHOT/CLIP/PLATE_READ/EVENT_LOG/NOTE
    description = Column(String, nullable=True)
    camera_uid = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)
    reference_event_id = Column(Integer, ForeignKey("camera_events.id"), nullable=True)  # links to a real detection, when applicable

    added_at = Column(DateTime(timezone=True), server_default=func.now())
