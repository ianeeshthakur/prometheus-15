# /api/admin -- docs/frontend.md §3.8. Built during the docs/backend.md §12.4
# build-out. Not in the original stub list (that named auth/alerts/investigations/
# watchlists) -- created for the facial-recognition gate, which frontend.md §3.8's
# "AI & datasets" tab and docs/prd.md §13.2 both call for as a real, visible control.
from fastapi import APIRouter, Depends

from db.database import get_db
from sqlalchemy.orm import Session
import services.admin_settings_service as admin_settings_service
from typing import Optional

from schemas.admin_settings import FacialRecognitionAuthorizeRequest, FacialRecognitionStatusResponse
from schemas.user import AuditLogResponse
from schemas.event import AdapterErrorLogResponse
from core.security import require_admin, log_action
from models.user import User
from integration import mock_gov_adapters

router = APIRouter()


@router.get("/facial-recognition", response_model=FacialRecognitionStatusResponse)
async def get_facial_recognition_status(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Auth-required as of docs/backend.md §12.8 -- found genuinely open (no
    dependency at all) during a real re-check of docs/frontend.md's claim that all
    three Administration tabs are admin-only on the backend. This one wasn't: it leaked
    whether facial recognition is currently enabled and its full authorization history
    (who enabled/disabled it, when, why) to any unauthenticated caller -- exactly the
    kind of DPDP-sensitive detail this gate exists to protect in the first place."""
    return FacialRecognitionStatusResponse(
        currently_enabled=admin_settings_service.is_currently_enabled(db),
        history=admin_settings_service.get_history(db),
    )


@router.post("/facial-recognition/authorize", response_model=FacialRecognitionStatusResponse)
async def authorize_facial_recognition(
    payload: FacialRecognitionAuthorizeRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Explicit authorization workflow, never a default -- docs/prd.md §3 non-goal,
    DPDP Act 2023 / Puttaswamy judgment. Admin-only, requires a stated reason, and
    writes both a dedicated authorization-history row and a general audit-log entry."""
    admin_settings_service.authorize(db, payload.enabled, admin.username, payload.reason)
    log_action(
        "FACIAL_RECOGNITION_AUTHORIZED" if payload.enabled else "FACIAL_RECOGNITION_REVOKED",
        user=admin, resource_type="admin_setting", detail=payload.reason, db=db,
    )
    return FacialRecognitionStatusResponse(
        currently_enabled=admin_settings_service.is_currently_enabled(db),
        history=admin_settings_service.get_history(db),
    )


@router.get("/audit-log")
async def get_audit_log(limit: int = 100, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """docs/frontend.md §3.8's Audit log tab."""
    from models.user import AuditLogEntry

    entries = db.query(AuditLogEntry).order_by(AuditLogEntry.created_at.desc()).limit(limit).all()
    # Explicit response_model validation (not just `return {"entries": entries}`) --
    # found missing here while building the adapter-errors endpoint below: without it,
    # FastAPI's default encoder serializes the raw ORM datetime with no timezone
    # suffix, reproducing the exact "timestamps silently off by the server's UTC
    # offset" bug already fixed everywhere else via schemas/common.py's UtcDatetime
    # (commit ced635d). AuditLogResponse existed but was never actually wired in.
    return {"entries": [AuditLogResponse.model_validate(e) for e in entries]}


@router.get("/adapter-errors")
async def get_adapter_errors(
    camera_uid: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """docs/backend.md §2's structured error-reporting checklist item, closed
    2026-09-14 -- previously just plain logger.error() calls in
    adapters/rtsp.py/hls.py and video/ffmpeg_runner.py, now real, queryable rows
    (services/error_log_service.py). Admin-only, same reasoning as audit-log: this can
    include real (redacted) stream URLs and real camera identifiers, not something an
    unauthenticated or non-admin caller should see."""
    from services.error_log_service import list_adapter_errors

    entries = list_adapter_errors(db, camera_uid=camera_uid, limit=limit)
    return {"entries": [AdapterErrorLogResponse.model_validate(e) for e in entries]}


# -- Mock government database lookups (docs/backend.md §7) --------------------------
# Clearly labeled MOCK responses; no real credentialed access to any of these systems.


@router.get("/gov-lookup/vahan/{registration_number}")
async def lookup_vahan(registration_number: str, admin: User = Depends(require_admin)):
    return mock_gov_adapters.lookup_vahan(registration_number)


@router.get("/gov-lookup/sarthi/{license_number}")
async def lookup_sarthi(license_number: str, admin: User = Depends(require_admin)):
    return mock_gov_adapters.lookup_sarthi(license_number)


@router.get("/gov-lookup/egujcop/{identifier}")
async def lookup_egujcop(identifier: str, admin: User = Depends(require_admin)):
    return mock_gov_adapters.lookup_egujcop(identifier)


@router.get("/gov-lookup/afis/{identifier}")
async def lookup_afis(identifier: str, admin: User = Depends(require_admin)):
    return mock_gov_adapters.lookup_afis(identifier)


@router.get("/gov-lookup/nafis/{identifier}")
async def lookup_nafis(identifier: str, admin: User = Depends(require_admin)):
    return mock_gov_adapters.lookup_nafis(identifier)
