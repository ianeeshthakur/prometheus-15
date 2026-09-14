# Pydantic schemas for watchlist entries/matches -- docs/frontend.md §3.4.
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional
from enum import Enum

from core.sanitize import strip_html_tags
from schemas.common import UtcDatetime


class WatchlistCategory(str, Enum):
    STOLEN_VEHICLE = "STOLEN_VEHICLE"
    WANTED_PERSON = "WANTED_PERSON"
    CUSTOM = "CUSTOM"


class RiskLevel(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class WatchlistEntryBase(BaseModel):
    identifier: str
    category: WatchlistCategory
    description: Optional[str] = None
    risk_level: RiskLevel = RiskLevel.MEDIUM
    source: Optional[str] = None
    added_by: Optional[str] = None
    active: bool = True

    @field_validator("identifier", "description", "source", "added_by")
    @classmethod
    def sanitize_free_text(cls, v):
        # docs/backend.md §7.1/§12.6 -- see core/sanitize.py's module docstring.
        return strip_html_tags(v) if v else v


class WatchlistEntryCreate(WatchlistEntryBase):
    pass


class WatchlistEntryResponse(WatchlistEntryBase):
    id: int
    match_count: int  # derived, not stored -- see models/watchlist.py
    created_at: UtcDatetime
    updated_at: UtcDatetime

    model_config = ConfigDict(from_attributes=True)


class WatchlistMatchResponse(BaseModel):
    id: int
    watchlist_entry_id: int
    camera_uid: str
    matched_value: str
    confidence: Optional[float] = None
    matched_at: UtcDatetime

    model_config = ConfigDict(from_attributes=True)
