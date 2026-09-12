# Plate/identifier matching against watchlist entries -- docs/backend.md §5 Pipeline 5,
# docs/ai_pipelines.md §4.
#
# Exact match only. Fuzzy matching (Levenshtein/Jaro-Winkler, to tolerate OCR-noisy
# plate reads) is intentionally NOT implemented here yet: an untuned fuzzy threshold
# risks false-positive watchlist alerts on a policing tool, which is worse than a
# missed match -- setting a defensible threshold needs real OCR error-rate data first
# (docs/ai_pipelines.md §6 dataset onboarding loop / §7 sourcing plan), not a guessed
# cutoff. Track this as a follow-up, not a silent gap: docs/backend.md §12.
import logging
from typing import Optional
from sqlalchemy.orm import Session

from models.watchlist import WatchlistEntry
from services import watchlist_service

logger = logging.getLogger(__name__)


def match_identifier(db: Session, identifier: str) -> Optional[WatchlistEntry]:
    """`identifier` should already be normalized the same way watchlist entries are
    stored (e.g. OCR's normalized_text -- docs/ai_pipelines.md §2 -- uppercase, no
    separators). Returns the first active matching entry, or None."""
    if not identifier:
        return None
    return watchlist_service.get_by_identifier(db, identifier, active_only=True)
