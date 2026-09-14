# Camera registry CRUD + idempotent upsert -- docs/backend.md §5 Pipeline 1.
# Ported from contrib/aneesh/backend/services/camera_service.py, import paths adapted
# to the models/ and schemas/ packages.
import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from models.camera import Camera
from schemas.camera import CameraCreate

logger = logging.getLogger(__name__)


def get_camera_by_uid(db: Session, camera_uid: str) -> Optional[Camera]:
    return db.query(Camera).filter(Camera.camera_uid == camera_uid).first()


def create_camera(db: Session, camera_in: CameraCreate, onboarding_source: str = "MANUAL") -> Camera:
    db_obj = Camera(**camera_in.model_dump(), onboarding_source=onboarding_source)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def update_camera(db: Session, db_obj: Camera, obj_in: CameraCreate) -> Camera:
    update_data = obj_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def delete_camera(db: Session, db_obj: Camera) -> None:
    db.delete(db_obj)
    db.commit()


def set_camera_status(db: Session, camera_uid: str, status: str) -> Optional[Camera]:
    """Used by video/stream_manager.py when a stream exhausts its reconnect budget --
    reflects the real outcome in the registry (previously the DB row stayed ACTIVE
    forever regardless of whether the stream was actually reachable) without deleting
    the row, since a stream giving up is often transient (source-side restart,
    rate-limiting) rather than proof the camera itself is bad. A later manual
    /start resets the in-memory restart counter and gives it a fresh attempt."""
    db_obj = get_camera_by_uid(db, camera_uid)
    if not db_obj:
        return None
    db_obj.status = status
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def list_cameras(
    db: Session,
    department: Optional[str] = None,
    district: Optional[str] = None,
    protocol_type: Optional[str] = None,
    vms_vendor: Optional[str] = None,
    status: Optional[str] = None,
    department_scope: Optional[str] = None,
) -> List[Camera]:
    """`department_scope` is the *caller's* RBAC restriction (an OPERATOR's
    `User.department_scope`, docs/frontend.md §3.7's "role-based search" requirement)
    -- authoritative, applied regardless of what `department` the caller asked for.
    `department` is just an ordinary filter, same as the others."""
    query = db.query(Camera)
    if department_scope:
        query = query.filter(Camera.department == department_scope)
    elif department:
        query = query.filter(Camera.department == department)
    if district:
        query = query.filter(Camera.district == district)
    if protocol_type:
        query = query.filter(Camera.protocol_type == protocol_type)
    if vms_vendor:
        query = query.filter(Camera.vms_vendor == vms_vendor)
    if status:
        query = query.filter(Camera.status == status)
    return query.all()


def upsert_camera(db: Session, camera_in: CameraCreate, onboarding_source: str = "API_INGEST") -> tuple[Camera, bool]:
    """Idempotent camera creation. Returns (Camera, is_created)."""
    existing_camera = get_camera_by_uid(db, camera_in.camera_uid)
    if existing_camera:
        return update_camera(db, existing_camera, camera_in), False
    try:
        return create_camera(db, camera_in, onboarding_source=onboarding_source), True
    except IntegrityError:
        # Race condition handling
        db.rollback()
        existing_camera = get_camera_by_uid(db, camera_in.camera_uid)
        if existing_camera:
            return update_camera(db, existing_camera, camera_in), False
        raise


# Same known-departments list frontend.md §0.1 names (the 26-department scope isn't
# fully enumerated anywhere as data yet -- this is the working set actually seen in
# camera rows, not a hardcoded canonical list of all 26).
def get_gap_analysis(db: Session, expected_minimum: int = 3) -> List[dict]:
    """Coverage-shortfall report by district x department -- docs/frontend.md §3.1 Row 4
    / §3.7, docs/backend.md §12.4. Mirrors lib/mock-data.ts's getGapAnalysis() logic on
    the frontend, against the real registry instead of mock data."""
    from sqlalchemy import func

    rows = (
        db.query(Camera.district, Camera.department, func.count(Camera.id).label("camera_count"))
        .group_by(Camera.district, Camera.department)
        .all()
    )
    counts = {(r.district, r.department): r.camera_count for r in rows}

    districts = sorted({d for d, _ in counts.keys()})
    departments = sorted({dept for _, dept in counts.keys()})

    gaps = []
    for district in districts:
        for department in departments:
            count = counts.get((district, department), 0)
            shortfall = expected_minimum - count
            if shortfall > 0:
                gaps.append(
                    {
                        "district": district,
                        "department": department,
                        "camera_count": count,
                        "expected_minimum": expected_minimum,
                        "shortfall": shortfall,
                    }
                )
    gaps.sort(key=lambda g: g["shortfall"], reverse=True)
    return gaps
