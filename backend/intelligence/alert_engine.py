import logging
from typing import Dict, Any, List
from .events import NormalizedEvent
import asyncio

logger = logging.getLogger(__name__)

class AlertEngine:
    def __init__(self):
        self.subscribers = []

    async def process_event(self, event: NormalizedEvent):
        """Processes a normalized event and checks for alerts."""
        logger.info(f"Processing Event: {event.event_type} from {event.camera_id}")

        # Simple simulated watchlist check
        if event.plate_number and event.plate_number == "GJ05XX7821":
            alert = self._create_watchlist_alert(event)
            await self._notify_subscribers(alert)
        else:
            # Broadcast the raw event to UI
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
                "location": event.location
            }
        }

    def subscribe(self, queue: asyncio.Queue):
        self.subscribers.append(queue)

    def unsubscribe(self, queue: asyncio.Queue):
        if queue in self.subscribers:
            self.subscribers.remove(queue)

    async def _notify_subscribers(self, message: Dict[str, Any]):
        for queue in self.subscribers:
            await queue.put(message)

# Singleton instance
alert_engine = AlertEngine()
