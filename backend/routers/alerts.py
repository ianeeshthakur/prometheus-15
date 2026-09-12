# /api/alerts -- docs/frontend.md §3.3. Built during the docs/backend.md §12.4 build-out.
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from db.database import get_db
import services.alert_service as alert_service
import services.investigation_service as investigation_service
from schemas.alert import AlertResponse, AlertStatusUpdate
from schemas.investigation import InvestigationCreate, InvestigationResponse
from core.security import get_current_user, log_action
from models.user import User

router = APIRouter()


@router.get("/", response_model=List[AlertResponse])
async def list_alerts(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    district: Optional[str] = None,
    camera_uid: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return alert_service.list_alerts(db, severity, status, district, camera_uid)


@router.get("/{alert_uid}", response_model=AlertResponse)
async def get_alert(alert_uid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Audit-logged -- docs/backend.md §12.5: unlike the list endpoint above (routine
    triage browsing), opening one specific alert's full detail is the kind of access a
    real audit trail should show."""
    alert = alert_service.get_response_by_uid(db, alert_uid)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    log_action("ALERT_VIEWED", user=user, resource_type="alert", resource_id=alert_uid, db=db)
    return alert


@router.patch("/{alert_uid}/status", response_model=AlertResponse)
async def update_alert_status(
    alert_uid: str,
    payload: AlertStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    alert = alert_service.get_by_uid(db, alert_uid)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert_service.update_status(db, alert, payload.status)
    log_action(
        f"ALERT_{payload.status}", user=user, resource_type="alert", resource_id=alert_uid, db=db,
    )
    return alert_service.get_response_by_uid(db, alert_uid)


@router.post("/{alert_uid}/investigation", response_model=InvestigationResponse, status_code=201)
async def open_investigation_from_alert(
    alert_uid: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """docs/frontend.md §3.3's "Open Investigation" alert action."""
    alert = alert_service.get_by_uid(db, alert_uid)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    case = investigation_service.create_investigation(
        db,
        InvestigationCreate(
            title=f"Investigation from {alert.type.replace('_', ' ').title()} — {alert.entity}",
            entity=alert.entity,
            priority="HIGH" if alert.severity in ("CRITICAL", "HIGH") else "MEDIUM",
        ),
    )
    alert_service.link_investigation(db, alert, case.id)
    log_action(
        "INVESTIGATION_OPENED_FROM_ALERT", user=user, resource_type="investigation",
        resource_id=case.case_uid, detail=f"from alert {alert_uid}", db=db,
    )
    return case
