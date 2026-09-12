from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
import uuid

class NormalizedEvent(BaseModel):
    """
    Core schema for ALL events regardless of camera source.
    This decouples the Intelligence layer from the Integration layer.
    """
    event_id: str = Field(default_factory=lambda: f"EVT-{uuid.uuid4().hex[:8].upper()}")
    camera_id: str
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    event_type: str  # e.g., VEHICLE_DETECTED, PERSON_DETECTED, PLATE_RECOGNIZED
    object_id: Optional[str] = None
    object_type: Optional[str] = None
    confidence: float
    plate_number: Optional[str] = None
    location: str
    district: str
    attributes: Dict[str, Any] = Field(default_factory=dict)
