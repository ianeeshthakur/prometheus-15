# Watchlist matching tests -- docs/backend.md §5 Pipeline 5/§8/§12.3/§12.4. Converted
# from the original live-server script to real pytest.
import asyncio


def test_watchlist_requires_auth(client):
    resp = client.get("/api/watchlists/")
    assert resp.status_code == 401


def test_create_watchlist_entry(client, auth_headers):
    entry = {
        "identifier": "GJ01AB4521",
        "category": "STOLEN_VEHICLE",
        "description": "Reported stolen 2026-09-10",
        "risk_level": "CRITICAL",
        "source": "Test",
        "added_by": "tester",
    }
    resp = client.post("/api/watchlists/", json=entry, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    assert resp.json()["match_count"] == 0


def test_list_watchlist_includes_created_entry(client, auth_headers):
    resp = client.get("/api/watchlists/", headers=auth_headers)
    assert resp.status_code == 200
    assert any(e["identifier"] == "GJ01AB4521" for e in resp.json())


def test_matching_plate_produces_real_alert_and_increments_match_count(client, auth_headers):
    """The core docs/backend.md §12.3 fix: real DB-backed matching, not a hardcoded
    plate string -- verified by feeding an event through the real, in-process
    AlertEngine singleton and checking match_count actually increments."""
    from intelligence.alert_engine import alert_engine
    from intelligence.events import NormalizedEvent

    entry_id = next(e["id"] for e in client.get("/api/watchlists/", headers=auth_headers).json() if e["identifier"] == "GJ01AB4521")

    async def feed():
        queue = asyncio.Queue()
        alert_engine.subscribe(queue)

        matching = NormalizedEvent(
            camera_id="CAM-TEST-WATCHLIST",
            event_type="PLATE_RECOGNIZED",
            object_type="VEHICLE",
            confidence=0.91,
            plate_number="GJ01AB4521",
            location="Test Location",
            district="Ahmedabad",
        )
        await alert_engine.process_event(matching)
        matching_msg = await queue.get()

        non_matching = NormalizedEvent(
            camera_id="CAM-TEST-WATCHLIST",
            event_type="PLATE_RECOGNIZED",
            object_type="VEHICLE",
            confidence=0.91,
            plate_number="GJ99ZZ0000",
            location="Test Location",
            district="Ahmedabad",
        )
        await alert_engine.process_event(non_matching)
        non_matching_msg = await queue.get()

        alert_engine.unsubscribe(queue)
        return matching_msg, non_matching_msg

    matching_msg, non_matching_msg = asyncio.run(feed())

    assert matching_msg["type"] == "alert", f"Expected a watchlist alert, got: {matching_msg}"
    assert matching_msg["data"]["severity"] == "CRITICAL"
    assert matching_msg["data"]["watchlist_entry_id"] == entry_id

    assert non_matching_msg["type"] == "event", f"Expected a plain event, got: {non_matching_msg}"

    entry_after = next(e for e in client.get("/api/watchlists/", headers=auth_headers).json() if e["id"] == entry_id)
    assert entry_after["match_count"] == 1


def test_levenshtein_distance_correctness():
    """The fuzzy-matching capability's underlying algorithm -- docs/backend.md §12.5.
    Not testing the feature end-to-end here (it's off by default and depends on env
    config read at import time); this confirms the distance function itself is
    correct, independent of whether the feature is enabled."""
    from intelligence.watchlist_matcher import levenshtein_distance

    assert levenshtein_distance("GJ01AB4521", "GJ01AB4521") == 0
    assert levenshtein_distance("GJ01AB4521", "GJ01AB4521X") == 1  # one insertion
    assert levenshtein_distance("GJ01AB4521", "GJ01AB4520") == 1  # one substitution
    assert levenshtein_distance("GJ01AB4521", "XX99ZZ0000") > 5  # nothing alike


def test_fuzzy_match_disabled_by_default(client, auth_headers):
    """A near-miss plate must NOT match when the feature flag is off (the default) --
    this is the safety property the whole design hinges on."""
    from intelligence.watchlist_matcher import match_identifier
    from db.database import SessionLocal

    db = SessionLocal()
    try:
        # GJ01AB4521 exists (created earlier in this file); a one-character-off
        # near-miss must return None, not a fuzzy hit, with the flag at its default.
        result = match_identifier(db, "GJ01AB4522")
        assert result is None
    finally:
        db.close()
