# /api/watchlists -- docs/frontend.md §3.4. CRUD only for now (list/create); bulk CSV
# import (frontend.md §3.4 "Bulk import (CSV)") is not built yet -- see docs/backend.md
# §12, mirror routers/cameras.py's CSV path when it's built.
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional

from db.database import get_db
import services.watchlist_service as watchlist_service
from schemas.watchlist import WatchlistEntryCreate, WatchlistEntryResponse
from models.watchlist import WatchlistEntry

router = APIRouter()


def _to_response(db: Session, entry: WatchlistEntry) -> WatchlistEntryResponse:
    return WatchlistEntryResponse(
        id=entry.id,
        identifier=entry.identifier,
        category=entry.category,
        description=entry.description,
        risk_level=entry.risk_level,
        source=entry.source,
        added_by=entry.added_by,
        active=entry.active,
        match_count=watchlist_service.get_match_count(db, entry.id),
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


@router.get("/", response_model=List[WatchlistEntryResponse])
async def list_watchlist(
    category: Optional[str] = None,
    active_only: bool = False,
    db: Session = Depends(get_db),
):
    entries = watchlist_service.list_entries(db, category, active_only)
    return [_to_response(db, e) for e in entries]


@router.post("/", response_model=WatchlistEntryResponse, status_code=201)
async def create_watchlist_entry(entry_in: WatchlistEntryCreate, db: Session = Depends(get_db)):
    entry = watchlist_service.create_entry(db, entry_in)
    return _to_response(db, entry)
