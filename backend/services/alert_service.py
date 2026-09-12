# Alert persistence + severity scoring -- docs/backend.md §5 Pipeline 5, §12.4.
import uuid
from typing import List, Optional
from sqlalchemy.orm import Session

from models.alert import Alert
from models.camera import Camera
from schemas.alert import AlertResponse

# Severity rubric (docs/backend.md §12.4 -- previously undefined):
# - WATCHLIST_MATCH: use the matched watchlist entry's own risk_level directly
#   (intelligence/alert_engine.py handles this case, doesn't call create_alert_for_anomaly).
# - ANOMALY: type-specific where meaningfully different, MEDIUM default otherwise.
#   anomaly_type stays an open string (docs/ai_pipelines.md §2) -- this map covers the
#   types currently produced by mock_providers.py / frontend mock data; anything else
#   falls back to the default rather than erroring.
# - Routine, unmatched PLATE_RECOGNIZED / PERSON_DETECTED events: NOT alert-worthy on
#   their own (docs/frontend.md §2's "Courteous" 7 C -- don't cry wolf on routine
#   reads). They're persisted as CameraEvent rows (services/event_service.py) but never
#   become an Alert.
ANOMALY_SEVERITY_MAP = {
    "WRONG_WAY": "CRITICAL",
    "UNATTENDED_OBJECT": "HIGH",
    "CROWD": "MEDIUM",
    "LOITERING": "MEDIUM",
}
DEFAULT_ANOMALY_SEVERITY = "MEDIUM"


def severity_for_anomaly(anomaly_type: str) -> str:
    return ANOMALY_SEVERITY_MAP.get(anomaly_type, DEFAULT_ANOMALY_SEVERITY)


def create_alert(
    db: Session,
    severity: str,
    type_: str,
    description: str,
    entity: str,
    camera_uid: str,
    confidence: float,
    watchlist_entry_id: Optional[int] = None,
) -> Alert:
    alert = Alert(
        alert_uid=f"ALT-{uuid.uuid4().hex[:8].upper()}",
        severity=severity,
        type=type_,
        description=description,
        entity=entity,
        camera_uid=camera_uid,
        confidence=confidence,
        watchlist_entry_id=watchlist_entry_id,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def _to_response(alert: Alert, camera: Optional[Camera]) -> AlertResponse:
    return AlertResponse(
        id=alert.id,
        alert_uid=alert.alert_uid,
        severity=alert.severity,
        type=alert.type,
        description=alert.description,
        entity=alert.entity,
        camera_uid=alert.camera_uid,
        camera_name=camera.name if camera else "Unknown",
        district=camera.district if camera else "Unknown",
        status=alert.status,
        confidence=alert.confidence,
        investigation_id=alert.investigation_id,
        created_at=alert.created_at,
        updated_at=alert.updated_at,
    )


def list_alerts(
    db: Session,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    district: Optional[str] = None,
    camera_uid: Optional[str] = None,
) -> List[AlertResponse]:
    query = db.query(Alert, Camera).join(Camera, Alert.camera_uid == Camera.camera_uid)
    if severity:
        query = query.filter(Alert.severity == severity)
    if status:
        query = query.filter(Alert.status == status)
    if district:
        query = query.filter(Camera.district == district)
    if camera_uid:
        query = query.filter(Alert.camera_uid == camera_uid)
    query = query.order_by(Alert.created_at.desc())
    return [_to_response(alert, camera) for alert, camera in query.all()]


def get_by_uid(db: Session, alert_uid: str) -> Optional[Alert]:
    return db.query(Alert).filter(Alert.alert_uid == alert_uid).first()


def get_response_by_uid(db: Session, alert_uid: str) -> Optional[AlertResponse]:
    row = (
        db.query(Alert, Camera)
        .join(Camera, Alert.camera_uid == Camera.camera_uid)
        .filter(Alert.alert_uid == alert_uid)
        .first()
    )
    if not row:
        return None
    alert, camera = row
    return _to_response(alert, camera)


def update_status(db: Session, alert: Alert, status: str) -> Alert:
    alert.status = status
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def link_investigation(db: Session, alert: Alert, investigation_id: int) -> Alert:
    alert.investigation_id = investigation_id
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert
