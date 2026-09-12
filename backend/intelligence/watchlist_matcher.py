# Plate/identifier matching against watchlist entries -- docs/backend.md §5 Pipeline 5,
# docs/ai_pipelines.md §4.
#
# Exact match is always on. Fuzzy (edit-distance) matching -- to tolerate OCR-noisy
# plate reads -- is implemented below but OFF BY DEFAULT (`ENABLE_FUZZY_WATCHLIST_
# MATCHING` in core/config.py): an untuned fuzzy threshold risks false-positive
# watchlist alerts on a policing tool, which is worse than a missed match. The
# algorithm itself isn't the guess -- edit distance is well-defined -- the *threshold*
# is, and setting a defensible one needs real OCR error-rate data
# (docs/ai_pipelines.md §6 dataset onboarding loop / §7 sourcing plan). The capability
# is built and ready; flip the flag once that data justifies a specific
# FUZZY_WATCHLIST_MAX_DISTANCE. Closes docs/backend.md §12.5's "fuzzy matching" gap as
# a real, tested, opt-in capability rather than leaving nothing built at all.
import logging
from typing import Optional
from sqlalchemy.orm import Session

from models.watchlist import WatchlistEntry
from services import watchlist_service
from core.config import ENABLE_FUZZY_WATCHLIST_MATCHING, FUZZY_WATCHLIST_MAX_DISTANCE

logger = logging.getLogger(__name__)


def levenshtein_distance(a: str, b: str) -> int:
    """Classic O(len(a)*len(b)) DP edit distance. No external dependency needed --
    plate-length strings (~10 chars) make this trivially fast."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)

    previous_row = list(range(len(b) + 1))
    for i, char_a in enumerate(a, start=1):
        current_row = [i]
        for j, char_b in enumerate(b, start=1):
            insert_cost = current_row[j - 1] + 1
            delete_cost = previous_row[j] + 1
            substitute_cost = previous_row[j - 1] + (char_a != char_b)
            current_row.append(min(insert_cost, delete_cost, substitute_cost))
        previous_row = current_row
    return previous_row[-1]


def match_identifier(db: Session, identifier: str) -> Optional[WatchlistEntry]:
    """`identifier` should already be normalized the same way watchlist entries are
    stored (e.g. OCR's normalized_text -- docs/ai_pipelines.md §2 -- uppercase, no
    separators). Tries an exact match first, always; falls back to fuzzy matching only
    if ENABLE_FUZZY_WATCHLIST_MATCHING is set (off by default, see module docstring).
    Returns the first/closest active matching entry, or None."""
    if not identifier:
        return None

    exact = watchlist_service.get_by_identifier(db, identifier, active_only=True)
    if exact:
        return exact

    if not ENABLE_FUZZY_WATCHLIST_MATCHING:
        return None

    return _match_fuzzy(db, identifier)


def _match_fuzzy(db: Session, identifier: str) -> Optional[WatchlistEntry]:
    best_entry: Optional[WatchlistEntry] = None
    best_distance = FUZZY_WATCHLIST_MAX_DISTANCE + 1

    for entry in watchlist_service.list_entries(db, active_only=True):
        distance = levenshtein_distance(identifier, entry.identifier)
        if distance <= FUZZY_WATCHLIST_MAX_DISTANCE and distance < best_distance:
            best_entry, best_distance = entry, distance

    if best_entry:
        logger.warning(
            f"Fuzzy watchlist match: {identifier!r} ~ {best_entry.identifier!r} "
            f"(distance={best_distance}) -- ENABLE_FUZZY_WATCHLIST_MATCHING is on; "
            "this is a lower-confidence match than an exact hit."
        )
    return best_entry
