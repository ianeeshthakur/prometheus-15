# Pydantic schemas for investigations/timeline/evidence -- docs/frontend.md §3.5,
# docs/backend.md §12.4.
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List
from enum import Enum

from schemas.event import CameraEventResponse
from schemas.alert import AlertResponse
from schemas.common import UtcDatetime
from core.sanitize import strip_html_tags


class InvestigationStatus(str, Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"


class InvestigationPriority(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class InvestigationCreate(BaseModel):
    title: str
    entity: str
    priority: InvestigationPriority = InvestigationPriority.MEDIUM
    assigned_officer: Optional[str] = None

    @field_validator("title", "entity", "assigned_officer")
    @classmethod
    def sanitize_free_text(cls, v):
        # docs/backend.md §7.1/§12.6 -- see core/sanitize.py's module docstring.
        return strip_html_tags(v) if v else v


class InvestigationResponse(BaseModel):
    id: int
    case_uid: str
    title: str
    entity: str
    status: InvestigationStatus
    priority: InvestigationPriority
    assigned_officer: Optional[str] = None
    created_at: UtcDatetime
    updated_at: UtcDatetime

    model_config = ConfigDict(from_attributes=True)


class InvestigationStatusUpdate(BaseModel):
    status: InvestigationStatus


class EvidenceCreate(BaseModel):
    evidence_type: str  # SNAPSHOT/CLIP/PLATE_READ/EVENT_LOG/NOTE
    description: Optional[str] = None
    camera_uid: Optional[str] = None
    confidence: Optional[float] = None
    reference_event_id: Optional[int] = None

    @field_validator("description")
    @classmethod
    def sanitize_free_text(cls, v):
        # docs/backend.md §7.1/§12.6 -- see core/sanitize.py's module docstring.
        return strip_html_tags(v) if v else v


class EvidenceResponse(BaseModel):
    id: int
    investigation_id: int
    evidence_type: str
    description: Optional[str] = None
    camera_uid: Optional[str] = None
    confidence: Optional[float] = None
    reference_event_id: Optional[int] = None
    added_at: UtcDatetime

    model_config = ConfigDict(from_attributes=True)


class TimelineResponse(BaseModel):
    events: List[CameraEventResponse]
    alerts: List[AlertResponse]


class TraceSighting(BaseModel):
    """One point on the entity's map trace -- docs/frontend.md §3.5's "Map trace" tab."""

    camera_uid: str
    camera_name: str
    district: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timestamp: UtcDatetime
    event_type: str
    confidence: float


class TraceResponse(BaseModel):
    entity: str
    sightings: List[TraceSighting]
