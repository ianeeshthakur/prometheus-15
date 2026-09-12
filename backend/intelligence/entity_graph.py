# Cross-camera entity correlation -- docs/ai_pipelines.md §4, docs/frontend.md §3.5
# "Map trace" tab. Built during the docs/backend.md §12.4 build-out.
#
# This is intentionally NOT a graph database or ML-based re-identification system --
# there is no stable person/vehicle identifier to correlate on beyond an exact
# normalized plate match yet (re-identification is a documented differentiator,
# docs/ai_pipelines.md §5, not built). What this does: given an identifier (a
# normalized plate today), pull every CameraEvent that carries it, join each to its
# camera's location, and order by time. That IS the hackathon's live vehicle-tracking
# test (docs/prd.md §0.1) -- a real timestamped, location-wise route -- just without
# graph-theoretic sophistication that isn't earned by the data available yet.
from typing import List
from sqlalchemy.orm import Session

from models.event import CameraEvent
from models.camera import Camera
from schemas.investigation import TraceSighting


def trace_entity(db: Session, identifier: str) -> List[TraceSighting]:
    rows = (
        db.query(CameraEvent, Camera)
        .join(Camera, CameraEvent.camera_uid == Camera.camera_uid)
        .filter(CameraEvent.identifier == identifier)
        .order_by(CameraEvent.created_at.asc())
        .all()
    )
    return [
        TraceSighting(
            camera_uid=camera.camera_uid,
            camera_name=camera.name,
            district=camera.district,
            latitude=camera.latitude,
            longitude=camera.longitude,
            timestamp=event.created_at,
            event_type=event.event_type,
            confidence=event.confidence,
        )
        for event, camera in rows
    ]
