# Pydantic schemas for normalized events -- docs/backend.md §12.4.
from pydantic import BaseModel, ConfigDict
from typing import Optional
from enum import Enum
from datetime import datetime


class EventObjectType(str, Enum):
    VEHICLE = "VEHICLE"
    PERSON = "PERSON"
    ANOMALY = "ANOMALY"


class CameraEventResponse(BaseModel):
    id: int
    event_uid: str
    camera_uid: str
    event_type: str
    object_type: Optional[str] = None
    identifier: Optional[str] = None
    confidence: float
    location: Optional[str] = None
    district: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
