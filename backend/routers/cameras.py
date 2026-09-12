# Camera registry API -- docs/backend.md §5 Pipeline 1 / §6. Ported from
# contrib/aneesh/backend/routers/cameras.py, with the legacy in-memory camera_registry
# merge removed (see adapters/factory.py's docstring for why) -- the DB is now the single
# source of truth, satisfying Model 1's requirement directly rather than merging two
# registries.
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
import csv
import io

from db.database import get_db
import schemas.camera as schemas
import services.camera_service as camera_service
from integration.discovery_adapter import SentinelCameraSource

router = APIRouter()


@router.get("/", response_model=Dict[str, List[schemas.CameraResponse]])
async def list_cameras(
    department: Optional[str] = None,
    district: Optional[str] = None,
    protocol_type: Optional[str] = None,
    vms_vendor: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Returns safe camera definitions without exposing credentials."""
    db_cameras = camera_service.list_cameras(db, department, district, protocol_type, vms_vendor, status)
    return {"cameras": db_cameras}


@router.get("/{camera_uid}", response_model=schemas.CameraResponse)
async def get_camera(camera_uid: str, db: Session = Depends(get_db)):
    db_cam = camera_service.get_camera_by_uid(db, camera_uid)
    if not db_cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    return db_cam


@router.post("/", response_model=schemas.CameraResponse, status_code=201)
async def create_camera_manual(camera_in: schemas.CameraCreate, db: Session = Depends(get_db)):
    """Manual single camera onboarding."""
    existing = camera_service.get_camera_by_uid(db, camera_in.camera_uid)
    if existing:
        raise HTTPException(status_code=409, detail="Camera with this UID already exists")
    return camera_service.create_camera(db, camera_in)


@router.post("/import/csv", response_model=schemas.ImportSummaryResponse)
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
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
            _, is_created = camera_service.upsert_camera(db, cam_data)
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
async def import_json(payload: List[Dict], db: Session = Depends(get_db)):
    """Bulk import cameras from a JSON array -- also the shape the /api/ingest catalogue
    sync (docs/backend.md §2, not yet built) would call into once it exists."""
    total = len(payload)
    created = duplicates = failed = 0
    errors: List[str] = []

    for idx, item in enumerate(payload):
        try:
            cam_data = SentinelCameraSource.normalize(item)
            _, is_created = camera_service.upsert_camera(db, cam_data)
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
