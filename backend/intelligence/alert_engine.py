# Alert engine: SSE pub/sub of normalized events + real watchlist matching --
# docs/backend.md §5 Pipeline 5.
#
# Fixed during the docs/backend.md §12.3 cleanup pass: the original migration's
# hardcoded single-plate-string check ("GJ05XX7821") is replaced with a real DB lookup
# via intelligence/watchlist_matcher.py against models/watchlist.py. A match is
# recorded (services/watchlist_service.record_match) so match_count/history are real,
# not just a broadcast alert that vanishes once no one's listening.
#
# STILL A GAP (docs/backend.md §12): alerts themselves are broadcast live via SSE but
# never persisted to a DB table (models/alert.py doesn't exist yet) -- there is no
# alert history/query API, only the live stream. Person-identifier matching isn't
# possible yet either: NormalizedEvent carries a plate_number but no stable person
# identifier (re-identification isn't built -- docs/ai_pipelines.md §5).
import logging
from typing import Dict, Any
from .events import NormalizedEvent
import asyncio

from db.database import SessionLocal
from intelligence.watchlist_matcher import match_identifier
from services.watchlist_service import record_match

logger = logging.getLogger(__name__)


class AlertEngine:
    def __init__(self):
        self.subscribers = []

    async def process_event(self, event: NormalizedEvent):
        """Processes a normalized event and checks for a real watchlist match."""
        logger.info(f"Processing Event: {event.event_type} from {event.camera_id}")

        alert = None
        if event.plate_number:
            db = SessionLocal()
            try:
                matched_entry = match_identifier(db, event.plate_number)
                if matched_entry:
                    # Snapshot the fields we need now -- record_match()'s commit()
                    # below expires this ORM instance's attributes, and db.close()
                    # right after would turn any later attribute access into a
                    # DetachedInstanceError.
                    entry_id, risk_level, category, description = (
                        matched_entry.id,
                        matched_entry.risk_level,
                        matched_entry.category,
                        matched_entry.description,
                    )
                    record_match(
                        db,
                        entry_id=entry_id,
                        camera_uid=event.camera_id,
                        matched_value=event.plate_number,
                        confidence=event.confidence,
                    )
                    alert = self._create_watchlist_alert(event, entry_id, risk_level, category, description)
            finally:
                db.close()

        if alert:
            await self._notify_subscribers(alert)
        else:
            await self._notify_subscribers({"type": "event", "data": event.model_dump()})

    def _create_watchlist_alert(
        self, event: NormalizedEvent, entry_id: int, risk_level: str, category: str, description: str
    ) -> Dict[str, Any]:
        return {
            "type": "alert",
            "data": {
                "alert_id": f"ALT-{event.event_id}",
                "severity": risk_level,
                "title": f"{category.replace('_', ' ').title()} Match",
                "description": description or f"Watchlist match for {event.plate_number}",
                "watchlist_entry_id": entry_id,
                "camera_id": event.camera_id,
                "timestamp": event.timestamp,
                "location": event.location,
            },
        }

    def subscribe(self, queue: asyncio.Queue):
        self.subscribers.append(queue)

    def unsubscribe(self, queue: asyncio.Queue):
        if queue in self.subscribers:
            self.subscribers.remove(queue)

    async def _notify_subscribers(self, message: Dict[str, Any]):
        for queue in self.subscribers:
            await queue.put(message)


# Module-level singleton, matching the original migration's pattern.
alert_engine = AlertEngine()
