# Pydantic schemas for watchlist entries/matches -- docs/frontend.md §3.4.
from pydantic import BaseModel, ConfigDict
from typing import Optional
from enum import Enum
from datetime import datetime


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


class WatchlistEntryCreate(WatchlistEntryBase):
    pass


class WatchlistEntryResponse(WatchlistEntryBase):
    id: int
    match_count: int  # derived, not stored -- see models/watchlist.py
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WatchlistMatchResponse(BaseModel):
    id: int
    watchlist_entry_id: int
    camera_uid: str
    matched_value: str
    confidence: Optional[float] = None
    matched_at: datetime

    model_config = ConfigDict(from_attributes=True)
