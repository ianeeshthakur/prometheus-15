# Watchlist CRUD + match recording -- docs/backend.md §5 Pipeline 5. Mirrors
# services/camera_service.py's pattern.
import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from models.watchlist import WatchlistEntry, WatchlistMatch
from schemas.watchlist import WatchlistEntryCreate

logger = logging.getLogger(__name__)


def create_entry(db: Session, entry_in: WatchlistEntryCreate) -> WatchlistEntry:
    db_obj = WatchlistEntry(**entry_in.model_dump())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def list_entries(db: Session, category: Optional[str] = None, active_only: bool = False) -> List[WatchlistEntry]:
    query = db.query(WatchlistEntry)
    if category:
        query = query.filter(WatchlistEntry.category == category)
    if active_only:
        query = query.filter(WatchlistEntry.active == True)  # noqa: E712
    return query.all()


def get_by_identifier(db: Session, identifier: str, active_only: bool = True) -> Optional[WatchlistEntry]:
    query = db.query(WatchlistEntry).filter(WatchlistEntry.identifier == identifier)
    if active_only:
        query = query.filter(WatchlistEntry.active == True)  # noqa: E712
    return query.first()


def get_match_count(db: Session, entry_id: int) -> int:
    return (
        db.query(func.count(WatchlistMatch.id))
        .filter(WatchlistMatch.watchlist_entry_id == entry_id)
        .scalar()
        or 0
    )


def record_match(
    db: Session, entry_id: int, camera_uid: str, matched_value: str, confidence: Optional[float] = None
) -> WatchlistMatch:
    match = WatchlistMatch(
        watchlist_entry_id=entry_id,
        camera_uid=camera_uid,
        matched_value=matched_value,
        confidence=confidence,
    )
    db.add(match)
    db.commit()
    db.refresh(match)
    return match
