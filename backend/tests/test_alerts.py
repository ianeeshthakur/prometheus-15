# Alert severity-rubric tests -- docs/backend.md §5 Pipeline 5/§12.4. Covers the
# anomaly-triggered alert path specifically (watchlist-triggered alerts are covered in
# test_investigations.py's full flow, alongside acknowledge/open-investigation).
import asyncio


def test_anomaly_event_creates_alert_with_mapped_severity(client):
    """services/alert_service.py's ANOMALY_SEVERITY_MAP: WRONG_WAY -> CRITICAL."""
    from intelligence.alert_engine import alert_engine
    from intelligence.events import NormalizedEvent

    cam = {
        "camera_uid": "CAM-ALERT-ANOMALY-001",
        "name": "Anomaly Test Camera",
        "department": "Police",
        "district": "Surat",
        "location": "Test Road",
        "vms_vendor": "Test",
        "protocol_type": "RTSP",
        "status": "ACTIVE",
        "ai_enabled": True,
    }
    resp = client.post("/api/cameras/", json=cam)
    assert resp.status_code in (201, 409)

    async def feed():
        queue = asyncio.Queue()
        alert_engine.subscribe(queue)
        ev = NormalizedEvent(
            camera_id="CAM-ALERT-ANOMALY-001",
            event_type="ANOMALY_WRONG_WAY",
            object_type="ANOMALY",
            confidence=0.8,
            location="Test Road",
            district="Surat",
            attributes={"anomaly_type": "WRONG_WAY"},
        )
        await alert_engine.process_event(ev)
        msg = await queue.get()
        alert_engine.unsubscribe(queue)
        return msg

    msg = asyncio.run(feed())
    assert msg["type"] == "alert"
    assert msg["data"]["severity"] == "CRITICAL"


def test_unmapped_anomaly_type_falls_back_to_default_severity(client):
    from intelligence.alert_engine import alert_engine
    from intelligence.events import NormalizedEvent

    async def feed():
        queue = asyncio.Queue()
        alert_engine.subscribe(queue)
        ev = NormalizedEvent(
            camera_id="CAM-ALERT-ANOMALY-001",
            event_type="ANOMALY_SOMETHING_NEW",
            object_type="ANOMALY",
            confidence=0.6,
            location="Test Road",
            district="Surat",
            attributes={"anomaly_type": "SOMETHING_NEW"},  # not in ANOMALY_SEVERITY_MAP
        )
        await alert_engine.process_event(ev)
        msg = await queue.get()
        alert_engine.unsubscribe(queue)
        return msg

    msg = asyncio.run(feed())
    assert msg["type"] == "alert"
    assert msg["data"]["severity"] == "MEDIUM"  # DEFAULT_ANOMALY_SEVERITY


def test_routine_unmatched_plate_does_not_create_alert(client):
    """docs/frontend.md §2's "Courteous" 7 C -- routine reads shouldn't cry wolf."""
    from intelligence.alert_engine import alert_engine
    from intelligence.events import NormalizedEvent

    async def feed():
        queue = asyncio.Queue()
        alert_engine.subscribe(queue)
        ev = NormalizedEvent(
            camera_id="CAM-ALERT-ANOMALY-001",
            event_type="PLATE_RECOGNIZED",
            object_type="VEHICLE",
            confidence=0.9,
            plate_number="GJ00ZZ9999",  # not on any watchlist
            location="Test Road",
            district="Surat",
        )
        await alert_engine.process_event(ev)
        msg = await queue.get()
        alert_engine.unsubscribe(queue)
        return msg

    msg = asyncio.run(feed())
    assert msg["type"] == "event"  # not "alert"
