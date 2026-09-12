from pydantic import BaseModel, Field, validator, ConfigDict
from typing import Optional, List
from enum import Enum
from datetime import datetime

class ProtocolType(str, Enum):
    RTSP = "RTSP"
    HLS = "HLS"
    ONVIF = "ONVIF"
    VENDOR_SDK = "VENDOR_SDK"

class CameraStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    DEGRADED = "DEGRADED"
    OFFLINE = "OFFLINE"

class CameraBase(BaseModel):
    camera_uid: str
    name: str
    department: str
    district: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    vms_vendor: str
    protocol_type: ProtocolType
    status: CameraStatus
    ai_enabled: bool = False

    @validator('latitude')
    def validate_latitude(cls, v):
        if v is not None and (v < -90 or v > 90):
            raise ValueError('Latitude must be between -90 and 90')
        return v

    @validator('longitude')
    def validate_longitude(cls, v):
        if v is not None and (v < -180 or v > 180):
            raise ValueError('Longitude must be between -180 and 180')
        return v

class CameraCreate(CameraBase):
    rtsp_url: Optional[str] = None

class CameraResponse(CameraBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ImportSummaryResponse(BaseModel):
    total_rows: int
    created: int
    duplicates: int
    failed: int
    errors: List[str]
