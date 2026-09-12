import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import models
import schemas

logger = logging.getLogger(__name__)

def get_camera_by_uid(db: Session, camera_uid: str) -> Optional[models.Camera]:
    return db.query(models.Camera).filter(models.Camera.camera_uid == camera_uid).first()

def create_camera(db: Session, camera_in: schemas.CameraCreate) -> models.Camera:
    db_obj = models.Camera(**camera_in.model_dump())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def update_camera(db: Session, db_obj: models.Camera, obj_in: schemas.CameraCreate) -> models.Camera:
    update_data = obj_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def list_cameras(db: Session, department: Optional[str] = None, district: Optional[str] = None, protocol_type: Optional[str] = None, vms_vendor: Optional[str] = None, status: Optional[str] = None) -> List[models.Camera]:
    query = db.query(models.Camera)
    if department:
        query = query.filter(models.Camera.department == department)
    if district:
        query = query.filter(models.Camera.district == district)
    if protocol_type:
        query = query.filter(models.Camera.protocol_type == protocol_type)
    if vms_vendor:
        query = query.filter(models.Camera.vms_vendor == vms_vendor)
    if status:
        query = query.filter(models.Camera.status == status)
    return query.all()

def upsert_camera(db: Session, camera_in: schemas.CameraCreate) -> tuple[models.Camera, bool]:
    """
    Idempotent camera creation.
    Returns (Camera, is_created).
    """
    existing_camera = get_camera_by_uid(db, camera_in.camera_uid)
    if existing_camera:
        # Update existing record (duplicate detected, idempotency maintained)
        return update_camera(db, existing_camera, camera_in), False
    else:
        # Create new record
        try:
            return create_camera(db, camera_in), True
        except IntegrityError:
            # Race condition handling
            db.rollback()
            existing_camera = get_camera_by_uid(db, camera_in.camera_uid)
            if existing_camera:
                return update_camera(db, existing_camera, camera_in), False
            raise
