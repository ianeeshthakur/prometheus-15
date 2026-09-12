from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from intelligence.schemas import IntelligenceEventResponse

class OperationalIntake(BaseModel):
    event: IntelligenceEventResponse

class AlertStatusUpdate(BaseModel):
    status: str
    actor_id: str
    reason: Optional[str] = None

class InvestigationCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "MEDIUM"
    source_alert_id: Optional[str] = None
    actor_id: str

class OperatorActionResponse(BaseModel):
    id: int
    action_id: str
    actor_id: str
    action_type: str
    target_type: str
    target_id: str
    previous_state: Optional[str] = None
    new_state: Optional[str] = None
    reason: Optional[str] = None
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

class AlertResponse(BaseModel):
    id: int
    alert_id: str
    source_event_id: str
    alert_type: str
    title: str
    description: Optional[str] = None
    priority: str
    severity: Optional[str] = None
    status: str
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    assigned_to: Optional[str] = None
    resolution_reason: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class InvestigationResponse(BaseModel):
    id: int
    investigation_id: str
    source_alert_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    assigned_investigator: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class TimelineEntryResponse(BaseModel):
    id: int
    entry_id: str
    investigation_id: str
    timestamp: datetime
    entry_type: str
    description: str
    reference_id: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class EvidenceResponse(BaseModel):
    id: int
    evidence_id: str
    investigation_id: str
    source_type: str
    source_reference: str
    evidence_type: str
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
