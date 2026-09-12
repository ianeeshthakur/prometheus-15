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


def create_camera(db: Session, camera_in: CameraCreate) -> Camera:
    db_obj = Camera(**camera_in.model_dump())
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


def list_cameras(
    db: Session,
    department: Optional[str] = None,
    district: Optional[str] = None,
    protocol_type: Optional[str] = None,
    vms_vendor: Optional[str] = None,
    status: Optional[str] = None,
) -> List[Camera]:
    query = db.query(Camera)
    if department:
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


def upsert_camera(db: Session, camera_in: CameraCreate) -> tuple[Camera, bool]:
    """Idempotent camera creation. Returns (Camera, is_created)."""
    existing_camera = get_camera_by_uid(db, camera_in.camera_uid)
    if existing_camera:
        return update_camera(db, existing_camera, camera_in), False
    try:
        return create_camera(db, camera_in), True
    except IntegrityError:
        # Race condition handling
        db.rollback()
        existing_camera = get_camera_by_uid(db, camera_in.camera_uid)
        if existing_camera:
            return update_camera(db, existing_camera, camera_in), False
        raise
