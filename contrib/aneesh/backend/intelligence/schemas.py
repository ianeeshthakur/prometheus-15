from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class EntityType(str, Enum):
    PERSON = "PERSON"
    VEHICLE = "VEHICLE"
    LICENSE_PLATE = "LICENSE_PLATE"
    OBJECT = "OBJECT"
    CAMERA = "CAMERA"
    LOCATION = "LOCATION"
    EVENT = "EVENT"

class IntelligenceEntityBase(BaseModel):
    entity_id: str
    entity_type: EntityType
    attributes: Dict[str, Any] = Field(default_factory=dict)

class IntelligenceEntityCreate(IntelligenceEntityBase):
    pass

class IntelligenceEntityResponse(IntelligenceEntityBase):
    id: int
    first_seen: datetime
    last_seen: datetime
    model_config = ConfigDict(from_attributes=True)

class IntelligenceObservationBase(BaseModel):
    observation_id: str
    entity_id: str
    camera_uid: str
    department: Optional[str] = None
    timestamp: datetime
    confidence: float
    attributes: Dict[str, Any] = Field(default_factory=dict)

class IntelligenceObservationCreate(IntelligenceObservationBase):
    pass

class IntelligenceObservationResponse(IntelligenceObservationBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class IntelligenceEventBase(BaseModel):
    event_id: str
    event_type: str
    timestamp: datetime
    severity: Optional[str] = None
    confidence: float
    description: Optional[str] = None
    related_entities: List[str] = Field(default_factory=list)
    evidence: Dict[str, Any] = Field(default_factory=dict)
    status: str = "NEW"

class IntelligenceEventCreate(IntelligenceEventBase):
    pass

class IntelligenceEventResponse(IntelligenceEventBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class WatchlistMatchBase(BaseModel):
    match_id: str
    watchlist_id: str
    entity_id: str
    match_type: str
    confidence: float

class WatchlistMatchCreate(WatchlistMatchBase):
    pass

class WatchlistMatchResponse(WatchlistMatchBase):
    id: int
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

class CanonicalExternalRecord(BaseModel):
    source: str
    status: str # e.g. REAL, MOCK, STUB, NOT_CONFIGURED, UNAVAILABLE
    data: Dict[str, Any] = Field(default_factory=dict)
    
class CorrelatedIntelligenceResult(BaseModel):
    observations: List[IntelligenceObservationResponse] = Field(default_factory=list)
    events: List[IntelligenceEventResponse] = Field(default_factory=list)
    watchlist_matches: List[WatchlistMatchResponse] = Field(default_factory=list)
