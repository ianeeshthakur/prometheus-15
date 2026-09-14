# CameraEvent persistence -- docs/backend.md §12.4.
import uuid
from typing import List, Optional
from sqlalchemy.orm import Session

from models.event import CameraEvent


def record_event(
    db: Session,
    camera_uid: str,
    event_type: str,
    confidence: float,
    object_type: Optional[str] = None,
    identifier: Optional[str] = None,
    location: Optional[str] = None,
    district: Optional[str] = None,
) -> CameraEvent:
    event = CameraEvent(
        event_uid=f"EVT-{uuid.uuid4().hex[:8].upper()}",
        camera_uid=camera_uid,
        event_type=event_type,
        object_type=object_type,
        identifier=identifier,
        confidence=confidence,
        location=location,
        district=district,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def list_events_by_identifier(db: Session, identifier: str) -> List[CameraEvent]:
    return (
        db.query(CameraEvent)
        .filter(CameraEvent.identifier == identifier)
        .order_by(CameraEvent.created_at.asc())
        .all()
    )


def list_events_by_camera(db: Session, camera_uid: str, limit: int = 50) -> List[CameraEvent]:
    return (
        db.query(CameraEvent)
        .filter(CameraEvent.camera_uid == camera_uid)
        .order_by(CameraEvent.created_at.desc())
        .limit(limit)
        .all()
    )
