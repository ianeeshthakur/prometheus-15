# Pydantic I/O schemas for the camera registry. Ported from contrib/aneesh/backend/schemas.py.
from pydantic import BaseModel, field_validator, ConfigDict
from typing import Optional, List
from enum import Enum
from datetime import datetime

from ai.schemas import AIProfile
from core.sanitize import strip_html_tags


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


class OnboardingSource(str, Enum):
    """Which path created this camera row -- Model 1 names all three explicitly.
    Server-assigned only (services/camera_service.py), never client-settable."""

    MANUAL = "MANUAL"
    BULK_CSV = "BULK_CSV"
    BULK_JSON = "BULK_JSON"
    API_INGEST = "API_INGEST"


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
    # Which AIOrchestrator profile runs against this camera -- docs/backend.md §12.3 fix,
    # previously hardcoded to TRAFFIC everywhere.
    ai_profile: AIProfile = AIProfile.TRAFFIC

    @field_validator("latitude")
    @classmethod
    def validate_latitude(cls, v):
        if v is not None and (v < -90 or v > 90):
            raise ValueError("Latitude must be between -90 and 90")
        return v

    @field_validator("longitude")
    @classmethod
    def validate_longitude(cls, v):
        if v is not None and (v < -180 or v > 180):
            raise ValueError("Longitude must be between -180 and 180")
        return v

    @field_validator("name", "location", "department", "district", "vms_vendor")
    @classmethod
    def sanitize_free_text(cls, v):
        # docs/backend.md §7.1/§12.6 -- strip any HTML/script markup at the input
        # boundary, see core/sanitize.py's module docstring for why strip-not-escape.
        return strip_html_tags(v)


class CameraCreate(CameraBase):
    rtsp_url: Optional[str] = None


class CameraResponse(CameraBase):
    id: int
    onboarding_source: OnboardingSource = OnboardingSource.MANUAL
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ImportSummaryResponse(BaseModel):
    total_rows: int
    created: int
    duplicates: int
    failed: int
    errors: List[str]
