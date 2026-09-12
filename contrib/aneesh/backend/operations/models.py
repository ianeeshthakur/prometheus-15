from sqlalchemy import Column, Integer, String, DateTime, JSON
from sqlalchemy.sql import func
from db import Base

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(String, unique=True, index=True, nullable=False)
    source_event_id = Column(String, unique=True, index=True, nullable=False) # Ensures 1:1 with P4 event
    alert_type = Column(String, index=True, nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    priority = Column(String, nullable=False) # LOW, MEDIUM, HIGH, CRITICAL
    severity = Column(String, nullable=True)
    status = Column(String, nullable=False, default="NEW") # NEW, ACKNOWLEDGED, UNDER_REVIEW, ESCALATED, RESOLVED, DISMISSED
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    assigned_to = Column(String, nullable=True)
    resolution_reason = Column(String, nullable=True)

class Investigation(Base):
    __tablename__ = "investigations"

    id = Column(Integer, primary_key=True, index=True)
    investigation_id = Column(String, unique=True, index=True, nullable=False)
    source_alert_id = Column(String, index=True, nullable=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, nullable=False, default="OPEN") # OPEN, UNDER_REVIEW, ESCALATED, SUSPENDED, CLOSED
    priority = Column(String, nullable=False, default="MEDIUM")
    assigned_investigator = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)
    resolution_notes = Column(String, nullable=True)

class Evidence(Base):
    __tablename__ = "investigation_evidence"

    id = Column(Integer, primary_key=True, index=True)
    evidence_id = Column(String, unique=True, index=True, nullable=False)
    investigation_id = Column(String, index=True, nullable=False)
    source_type = Column(String, nullable=False) # e.g. INTELLIGENCE_EVENT, AI_OBSERVATION, EXTERNAL_RECORD
    source_reference = Column(String, nullable=False) # e.g. OBS-123, EVT-456
    evidence_type = Column(String, nullable=False)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TimelineEntry(Base):
    __tablename__ = "investigation_timeline"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(String, unique=True, index=True, nullable=False)
    investigation_id = Column(String, index=True, nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    entry_type = Column(String, nullable=False) # e.g. OBSERVATION, OPERATOR_ACTION, STATUS_CHANGE
    description = Column(String, nullable=False)
    reference_id = Column(String, nullable=True) # ID of the related object (alert, event, etc)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class OperatorAction(Base):
    __tablename__ = "operator_actions"

    id = Column(Integer, primary_key=True, index=True)
    action_id = Column(String, unique=True, index=True, nullable=False)
    actor_id = Column(String, nullable=False) # E.g., 'system', or 'officer-1'
    action_type = Column(String, nullable=False) # e.g. ALERT_ACKNOWLEDGED, INVESTIGATION_OPENED
    target_type = Column(String, nullable=False) # ALERT, INVESTIGATION
    target_id = Column(String, nullable=False)
    previous_state = Column(String, nullable=True)
    new_state = Column(String, nullable=True)
    reason = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
