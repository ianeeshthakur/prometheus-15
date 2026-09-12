from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
import csv
import io
import json

from db import get_db
import schemas
import services.camera_service as camera_service
from integration.camera_registry import camera_registry
from integration.discovery_adapter import SentinelCameraSource

router = APIRouter()

def _merge_registry_and_db_cameras(db_cameras: List[schemas.CameraResponse]):
    """Merges static legacy registry cameras with the new database-driven ones."""
    result = []

    # 1. Add DB cameras first
    for db_cam in db_cameras:
        result.append(db_cam.model_dump())

    # 2. Add Legacy cameras, ensuring we don't duplicate if a DB camera has same UID
    db_uids = {cam.camera_uid for cam in db_cameras}
    legacy_cams = camera_registry.get_all()
    for legacy_cam in legacy_cams:
        if legacy_cam["id"] not in db_uids:
            # Format legacy cam to look somewhat like the new ones for consistency
            result.append({
                "camera_uid": legacy_cam["id"],
                "id": legacy_cam["id"], # Legacy ID
                "name": legacy_cam["name"],
                "department": "Legacy",
                "district": legacy_cam["district"],
                "location": legacy_cam["location"],
                "latitude": None,
                "longitude": None,
                "vms_vendor": "Sentinel",
                "protocol_type": "RTSP",
                "status": "ACTIVE",
                "ai_enabled": legacy_cam.get("ai_enabled", False),
                "source_type": legacy_cam.get("source_type")
            })
    return result


@router.get("/", response_model=Dict[str, List[Dict]])
async def list_cameras(
    department: Optional[str] = None,
    district: Optional[str] = None,
    protocol_type: Optional[str] = None,
    vms_vendor: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Returns safe camera definitions without exposing credentials."""
    db_cameras = camera_service.list_cameras(db, department, district, protocol_type, vms_vendor, status)

    # We convert DB models to Pydantic responses first to strip private data like rtsp_url
    safe_db_cameras = [schemas.CameraResponse.model_validate(cam) for cam in db_cameras]

    merged_cameras = _merge_registry_and_db_cameras(safe_db_cameras)

    # Note: Backend filtering only applied to DB cameras above.
    # If we wanted to filter legacy cameras too, we'd add logic here.
    # For now, it's sufficient to merge them.

    return {"cameras": merged_cameras}


@router.get("/{camera_uid}", response_model=Dict)
async def get_camera(camera_uid: str, db: Session = Depends(get_db)):
    # 1. Try DB first
    db_cam = camera_service.get_camera_by_uid(db, camera_uid)
    if db_cam:
        return schemas.CameraResponse.model_validate(db_cam).model_dump()

    # 2. Try legacy registry
    legacy_cams = camera_registry.get_all()
    cam = next((c for c in legacy_cams if c["id"] == camera_uid), None)
    if cam:
        cam["camera_uid"] = cam["id"]
        return cam

    raise HTTPException(status_code=404, detail="Camera not found")


@router.post("/", response_model=schemas.CameraResponse, status_code=201)
async def create_camera_manual(camera_in: schemas.CameraCreate, db: Session = Depends(get_db)):
    """Manual single camera onboarding."""
    existing = camera_service.get_camera_by_uid(db, camera_in.camera_uid)
    if existing:
        raise HTTPException(status_code=409, detail="Camera with this UID already exists")

    new_cam = camera_service.create_camera(db, camera_in)
    return new_cam


@router.post("/import/csv", response_model=schemas.ImportSummaryResponse)
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Bulk import cameras from CSV file."""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    contents = await file.read()
    decoded = contents.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))

    total = 0
    created = 0
    duplicates = 0
    failed = 0
    errors = []

    for row in reader:
        total += 1
        try:
            # Map CSV row to schema
            cam_data = SentinelCameraSource.normalize(row)
            # Upsert
            _, is_created = camera_service.upsert_camera(db, cam_data)
            if is_created:
                created += 1
            else:
                duplicates += 1
        except Exception as e:
            failed += 1
            errors.append(f"Row {total} failed: {str(e)}")

    return schemas.ImportSummaryResponse(
        total_rows=total,
        created=created,
        duplicates=duplicates,
        failed=failed,
        errors=errors
    )


@router.post("/import/json", response_model=schemas.ImportSummaryResponse)
async def import_json(payload: List[Dict], db: Session = Depends(get_db)):
    """Bulk import cameras from JSON array."""
    total = len(payload)
    created = 0
    duplicates = 0
    failed = 0
    errors = []

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
        total_rows=total,
        created=created,
        duplicates=duplicates,
        failed=failed,
        errors=errors
    )
