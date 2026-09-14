# Pydantic schemas for alerts -- docs/frontend.md §3.3, docs/backend.md §12.4.
from pydantic import BaseModel, ConfigDict
from typing import Optional
from enum import Enum
from datetime import datetime


class AlertSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class AlertType(str, Enum):
    ANPR_MATCH = "ANPR_MATCH"
    WATCHLIST_MATCH = "WATCHLIST_MATCH"
    ANOMALY = "ANOMALY"
    PERSON_MATCH = "PERSON_MATCH"


class AlertStatus(str, Enum):
    NEW = "NEW"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    ESCALATED = "ESCALATED"
    RESOLVED = "RESOLVED"


class AlertResponse(BaseModel):
    id: int
    alert_uid: str
    severity: AlertSeverity
    type: AlertType
    description: str
    entity: str
    camera_uid: str
    camera_name: str  # joined from Camera at query time -- see services/alert_service.py
    district: str  # joined from Camera at query time
    status: AlertStatus
    confidence: float
    investigation_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertStatusUpdate(BaseModel):
    status: AlertStatus
