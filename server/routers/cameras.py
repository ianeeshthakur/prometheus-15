# Camera registry API -- docs/backend.md §5 Pipeline 1 / §6. Ported from
# contrib/aneesh/backend/routers/cameras.py, with the legacy in-memory camera_registry
# merge removed (see adapters/factory.py's docstring for why) -- the DB is now the single
# source of truth, satisfying Model 1's requirement directly rather than merging two
# registries.
#
# Auth required on list/get as of docs/backend.md §12.5's cleanup -- camera locations
# and department ownership are sensitive registry data, unauthenticated read access
# was a real gap. list_cameras also now enforces role-based department scoping
# (frontend.md §3.7): an OPERATOR only ever sees their own department's cameras,
# regardless of what `department` filter they pass; ADMIN is unrestricted.
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
import csv
import io

from db.database import get_db
import schemas.camera as schemas
import services.camera_service as camera_service
from integration.discovery_adapter import SentinelCameraSource
from integration.ingest_sync import sync_from_ingest_api, preview_ingest_catalogue
from core.security import require_admin, get_current_user, log_action
from models.user import User

router = APIRouter()


@router.get("/gap-analysis")
async def gap_analysis(expected_minimum: int = 3, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Coverage-shortfall report by district x department -- docs/frontend.md §3.1 Row 4
    / §3.7, the Model 1 "gap-analysis report" requirement (docs/prd.md §0.1)."""
    return {"gaps": camera_service.get_gap_analysis(db, expected_minimum)}


@router.get("/ingest-preview")
async def ingest_preview(admin: User = Depends(require_admin)):
    """Fetches the real /api/ingest catalogue AS-IS -- no normalization, no DB writes
    -- docs/backend.md §12.7. Use this first the moment INGEST_API_BASE_URL is
    configured, to see the real field names before trusting sync-ingest with writes;
    see integration/ingest_sync.py's module docstring."""
    try:
        return preview_ingest_catalogue()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach ingest API: {e}")


@router.post("/sync-ingest", response_model=schemas.ImportSummaryResponse)
async def sync_ingest(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Pulls the hackathon's real /api/ingest catalogue and upserts it into the
    registry -- docs/backend.md §2/§12.4. Admin-only since it can bulk-create/modify
    camera rows. Returns 400 with a clear message if INGEST_API_BASE_URL isn't
    configured, rather than silently no-op'ing."""
    try:
        summary = sync_from_ingest_api(db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach ingest API: {e}")
    log_action(
        "INGEST_SYNC", user=admin, resource_type="camera",
        detail=f"created={summary.created} duplicates={summary.duplicates} failed={summary.failed}", db=db,
    )
    return summary


@router.get("/", response_model=Dict[str, List[schemas.CameraResponse]])
async def list_cameras(
    department: Optional[str] = None,
    district: Optional[str] = None,
    protocol_type: Optional[str] = None,
    vms_vendor: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Returns safe camera definitions without exposing credentials. An OPERATOR's
    department_scope is enforced server-side (see camera_service.list_cameras) --
    role-based search, not just an optional filter the client could ignore."""
    scope = user.department_scope if user.role != "ADMIN" else None
    db_cameras = camera_service.list_cameras(db, department, district, protocol_type, vms_vendor, status, department_scope=scope)
    return {"cameras": db_cameras}


@router.get("/{camera_uid}", response_model=schemas.CameraResponse)
async def get_camera(camera_uid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db_cam = camera_service.get_camera_by_uid(db, camera_uid)
    if not db_cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    if user.role != "ADMIN" and user.department_scope and db_cam.department != user.department_scope:
        raise HTTPException(status_code=403, detail="Camera is outside your department scope")
    return db_cam


@router.post("/", response_model=schemas.CameraResponse, status_code=201)
async def create_camera_manual(
    camera_in: schemas.CameraCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    """Manual single camera onboarding."""
    existing = camera_service.get_camera_by_uid(db, camera_in.camera_uid)
    if existing:
        raise HTTPException(status_code=409, detail="Camera with this UID already exists")
    camera = camera_service.create_camera(db, camera_in, onboarding_source="MANUAL")
    log_action("CAMERA_CREATED", user=user, resource_type="camera", resource_id=camera.camera_uid, db=db)
    return camera


@router.post("/import/csv", response_model=schemas.ImportSummaryResponse)
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Bulk import cameras from CSV file."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    contents = await file.read()
    decoded = contents.decode("utf-8")
    reader = csv.DictReader(io.StringIO(decoded))

    total = created = duplicates = failed = 0
    errors: List[str] = []

    for row in reader:
        total += 1
        try:
            cam_data = SentinelCameraSource.normalize(row)
            _, is_created = camera_service.upsert_camera(db, cam_data, onboarding_source="BULK_CSV")
            if is_created:
                created += 1
            else:
                duplicates += 1
        except Exception as e:
            failed += 1
            errors.append(f"Row {total} failed: {str(e)}")

    return schemas.ImportSummaryResponse(
        total_rows=total, created=created, duplicates=duplicates, failed=failed, errors=errors
    )


@router.post("/import/json", response_model=schemas.ImportSummaryResponse)
async def import_json(payload: List[Dict], db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Bulk import cameras from a JSON array -- also the shape the /api/ingest catalogue
    sync (integration/ingest_sync.py) calls into."""
    total = len(payload)
    created = duplicates = failed = 0
    errors: List[str] = []

    for idx, item in enumerate(payload):
        try:
            cam_data = SentinelCameraSource.normalize(item)
            _, is_created = camera_service.upsert_camera(db, cam_data, onboarding_source="BULK_JSON")
            if is_created:
                created += 1
            else:
                duplicates += 1
        except Exception as e:
            failed += 1
            errors.append(f"Item at index {idx} failed: {str(e)}")

    return schemas.ImportSummaryResponse(
        total_rows=total, created=created, duplicates=duplicates, failed=failed, errors=errors
    )
