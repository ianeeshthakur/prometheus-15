# Alert engine: SSE pub/sub of normalized events + a first-cut watchlist check --
# docs/backend.md §5 Pipeline 5. Ported from contrib/aneesh/backend/intelligence/alert_engine.py.
#
# KNOWN GAP (docs/backend.md §12): the watchlist check below is a single hardcoded plate
# string, a placeholder from the original migration -- it is NOT real DB-backed watchlist
# matching. Replace with a real lookup against models/watchlist.py (not yet built) via
# intelligence/watchlist_matcher.py (currently a stub) before relying on this for anything
# beyond a demo. Also note: alerts are broadcast to subscribers but not yet persisted to
# models/alert.py (not yet built) -- there is no alert history/query API yet, only the
# live SSE stream.
import logging
from typing import Dict, Any
from .events import NormalizedEvent
import asyncio

logger = logging.getLogger(__name__)


class AlertEngine:
    def __init__(self):
        self.subscribers = []

    async def process_event(self, event: NormalizedEvent):
        """Processes a normalized event and checks for alerts."""
        logger.info(f"Processing Event: {event.event_type} from {event.camera_id}")

        # Placeholder watchlist check -- see module docstring above.
        if event.plate_number and event.plate_number == "GJ05XX7821":
            alert = self._create_watchlist_alert(event)
            await self._notify_subscribers(alert)
        else:
            await self._notify_subscribers({"type": "event", "data": event.model_dump()})

    def _create_watchlist_alert(self, event: NormalizedEvent) -> Dict[str, Any]:
        return {
            "type": "alert",
            "data": {
                "alert_id": f"ALT-{event.event_id}",
                "severity": "CRITICAL",
                "title": "Stolen Vehicle Detected",
                "description": f"Watchlist match for {event.plate_number}",
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
