# Alert engine: persists every event, creates real Alert rows for watchlist matches
# and anomalies, and broadcasts live via SSE -- docs/backend.md §5 Pipeline 5.
#
# Fixed/extended during the docs/backend.md §12.3/§12.4 build-out:
#   §12.3: watchlist matching is now a real DB lookup (intelligence/watchlist_matcher.py),
#     not a hardcoded plate string.
#   §12.4: every event is now persisted to CameraEvent (services/event_service.py) --
#     this was the "events broadcast live via SSE but never written to a DB table" gap.
#     Watchlist matches and anomalies now also create a real, persisted Alert row
#     (services/alert_service.py) with a real severity (the matched entry's risk_level,
#     or the anomaly-type severity map) instead of only a transient SSE payload.
#
# STILL A GAP (docs/backend.md §12): routine, unmatched PLATE_RECOGNIZED/
# PERSON_DETECTED events are persisted as CameraEvent but deliberately do NOT become
# Alert rows -- see services/alert_service.py's module docstring for the rubric and
# rationale. Person-identifier watchlist matching isn't possible yet either:
# NormalizedEvent carries a plate_number but no stable person identifier
# (re-identification isn't built -- docs/ai_pipelines.md §5).
import logging
from typing import Dict, Any
from .events import NormalizedEvent
import asyncio

from db.database import SessionLocal
from intelligence.watchlist_matcher import match_identifier
from services.watchlist_service import record_match
from services import event_service, alert_service

logger = logging.getLogger(__name__)


class AlertEngine:
    def __init__(self):
        self.subscribers = []

    async def process_event(self, event: NormalizedEvent):
        """Persists the event, checks for a watchlist match or anomaly, and broadcasts
        the result (a real alert or a plain event) to subscribers."""
        logger.info(f"Processing Event: {event.event_type} from {event.camera_id}")

        db = SessionLocal()
        try:
            event_service.record_event(
                db,
                camera_uid=event.camera_id,
                event_type=event.event_type,
                confidence=event.confidence,
                object_type=event.object_type,
                identifier=event.plate_number,
                location=event.location,
                district=event.district,
            )

            alert_payload = None

            if event.plate_number:
                matched_entry = match_identifier(db, event.plate_number)
                if matched_entry:
                    # Snapshot fields now -- record_match()'s commit() below expires
                    # this ORM instance, and using it after would raise
                    # DetachedInstanceError (hit this for real during the §12.3 fix).
                    entry_id, risk_level, category, description = (
                        matched_entry.id,
                        matched_entry.risk_level,
                        matched_entry.category,
                        matched_entry.description,
                    )
                    record_match(
                        db, entry_id=entry_id, camera_uid=event.camera_id,
                        matched_value=event.plate_number, confidence=event.confidence,
                    )
                    alert = alert_service.create_alert(
                        db,
                        severity=risk_level,
                        type_="WATCHLIST_MATCH",
                        description=description or f"Watchlist match for {event.plate_number}",
                        entity=event.plate_number,
                        camera_uid=event.camera_id,
                        confidence=event.confidence,
                        watchlist_entry_id=entry_id,
                    )
                    alert_payload = self._alert_to_message(alert, watchlist_entry_id=entry_id)

            anomaly_type = (event.attributes or {}).get("anomaly_type")
            if alert_payload is None and anomaly_type:
                severity = alert_service.severity_for_anomaly(anomaly_type)
                alert = alert_service.create_alert(
                    db,
                    severity=severity,
                    type_="ANOMALY",
                    description=f"{anomaly_type.replace('_', ' ').title()} detected",
                    entity=anomaly_type,
                    camera_uid=event.camera_id,
                    confidence=event.confidence,
                )
                alert_payload = self._alert_to_message(alert)
        finally:
            db.close()

        if alert_payload:
            await self._notify_subscribers(alert_payload)
        else:
            await self._notify_subscribers({"type": "event", "data": event.model_dump()})

    def _alert_to_message(self, alert, watchlist_entry_id: int | None = None) -> Dict[str, Any]:
        return {
            "type": "alert",
            "data": {
                "alert_id": alert.alert_uid,
                "severity": alert.severity,
                "title": alert.type.replace("_", " ").title(),
                "description": alert.description,
                "watchlist_entry_id": watchlist_entry_id,
                "camera_id": alert.camera_uid,
                "timestamp": alert.created_at.isoformat(),
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
