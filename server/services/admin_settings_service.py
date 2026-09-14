# Facial-recognition gate logic -- docs/backend.md §12.4.
from typing import List
from sqlalchemy.orm import Session

from models.admin_settings import FacialRecognitionAuthorization


def authorize(db: Session, enabled: bool, authorized_by: str, reason: str) -> FacialRecognitionAuthorization:
    entry = FacialRecognitionAuthorization(enabled=enabled, authorized_by=authorized_by, reason=reason)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def get_history(db: Session, limit: int = 50) -> List[FacialRecognitionAuthorization]:
    return (
        db.query(FacialRecognitionAuthorization)
        .order_by(FacialRecognitionAuthorization.created_at.desc())
        .limit(limit)
        .all()
    )


def is_currently_enabled(db: Session) -> bool:
    latest = (
        db.query(FacialRecognitionAuthorization)
        .order_by(FacialRecognitionAuthorization.created_at.desc())
        .first()
    )
    return latest.enabled if latest else False  # never enabled by default -- docs/prd.md §3 non-goal
