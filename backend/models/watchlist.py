# WatchlistEntry + WatchlistMatch tables -- docs/backend.md §5 Pipeline 5,
# docs/frontend.md §3.4. Built during the docs/backend.md §12.3 cleanup pass to replace
# intelligence/alert_engine.py's single hardcoded plate string with real DB-backed
# watchlist matching.
#
# match_count (frontend.md §3.4) is deliberately NOT a stored counter on WatchlistEntry
# -- it's derived by counting WatchlistMatch rows (services/watchlist_service.py
# get_match_count()), which also gives a full match history/audit trail for free
# instead of just a number.
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey
from sqlalchemy.sql import func

from db.base import Base


class WatchlistEntry(Base):
    __tablename__ = "watchlist_entries"

    id = Column(Integer, primary_key=True, index=True)
    # Normalized plate text (ai/schemas.py PlateResult.normalized_text -- uppercase, no
    # separators) or a person/vehicle identifier. Not unique: the same plate could
    # legitimately appear on two different entries over time (e.g. re-registered under
    # a new case); category + active status disambiguate which is live.
    identifier = Column(String, index=True, nullable=False)
    category = Column(String, nullable=False)  # STOLEN_VEHICLE, WANTED_PERSON, CUSTOM
    description = Column(String, nullable=True)
    risk_level = Column(String, nullable=False, default="MEDIUM")  # CRITICAL/HIGH/MEDIUM/LOW
    source = Column(String, nullable=True)
    added_by = Column(String, nullable=True)
    active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class WatchlistMatch(Base):
    __tablename__ = "watchlist_matches"

    id = Column(Integer, primary_key=True, index=True)
    watchlist_entry_id = Column(Integer, ForeignKey("watchlist_entries.id"), nullable=False, index=True)
    camera_uid = Column(String, nullable=False)
    matched_value = Column(String, nullable=False)  # what was actually read/detected, not just the entry's identifier
    confidence = Column(Float, nullable=True)
    matched_at = Column(DateTime(timezone=True), server_default=func.now())
