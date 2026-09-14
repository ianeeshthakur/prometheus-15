# /api/admin -- docs/frontend.md §3.8. Built during the docs/backend.md §12.4
# build-out. Not in the original stub list (that named auth/alerts/investigations/
# watchlists) -- created for the facial-recognition gate, which frontend.md §3.8's
# "AI & datasets" tab and docs/prd.md §13.2 both call for as a real, visible control.
from fastapi import APIRouter, Depends

from db.database import get_db
from sqlalchemy.orm import Session
import services.admin_settings_service as admin_settings_service
from schemas.admin_settings import FacialRecognitionAuthorizeRequest, FacialRecognitionStatusResponse
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
    return {"entries": entries}


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
