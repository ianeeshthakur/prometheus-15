# Pydantic schemas for normalized events -- docs/backend.md §12.4.
from pydantic import BaseModel, ConfigDict
from typing import Optional
from enum import Enum

from schemas.common import UtcDatetime


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
    created_at: UtcDatetime

    model_config = ConfigDict(from_attributes=True)


class ClientErrorReport(BaseModel):
    """POST body for the real client-side error log -- docs/backend.md §2's checklist
    item, "client-side error log" half. camera_uid is optional since not every
    frontend error is camera-scoped (a page could report a non-camera failure later)."""

    camera_uid: Optional[str] = None
    client_name: str  # e.g. "browser-hls.js" -- required, this endpoint exists specifically to record it
    client_version: str
    error_type: str
    error_message: Optional[str] = None


class AdapterErrorLogResponse(BaseModel):
    id: int
    camera_uid: Optional[str] = None
    source: str
    url_redacted: Optional[str] = None
    client_name: Optional[str] = None
    client_version: Optional[str] = None
    error_type: str
    error_message: Optional[str] = None
    created_at: UtcDatetime

    model_config = ConfigDict(from_attributes=True)
