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


def test_threshold_calibration_tool_on_synthetic_data():
    """docs/backend.md §12.7 -- validates the CALIBRATION TOOL's precision/recall math
    is correct, using hand-constructed synthetic examples with a known right answer.
    This deliberately does NOT derive or suggest a real FUZZY_WATCHLIST_MAX_DISTANCE --
    see calibrate_threshold()'s docstring for why that needs real OCR data, not
    synthetic examples. This test only proves the tool computes precision/recall
    correctly, so it's trustworthy the day real data is fed into it."""
    from intelligence.watchlist_matcher import CalibrationExample, calibrate_threshold

    examples = [
        # True positives at distance 0 (exact) and 1 (one-character OCR noise).
        CalibrationExample(ocr_reading="GJ01AB4521", ground_truth="GJ01AB4521", is_same_plate=True),
        CalibrationExample(ocr_reading="GJ01AB4520", ground_truth="GJ01AB4521", is_same_plate=True),
        # A genuinely different plate that happens to be distance 1 away -- the exact
        # false-positive risk fuzzy matching creates. At threshold>=1 this becomes a
        # false positive, which is what should tank precision at that threshold.
        CalibrationExample(ocr_reading="GJ01AB4529", ground_truth="GJ01AB4521", is_same_plate=False),
        # An easy true negative, far away at every threshold tested.
        CalibrationExample(ocr_reading="MH12ZZ9999", ground_truth="GJ01AB4521", is_same_plate=False),
    ]

    recommended, stats = calibrate_threshold(examples, max_threshold=2, min_precision=0.99)

    stats_by_threshold = {s.threshold: s for s in stats}
    # Threshold 0: only the exact match counts, no false positives possible -> perfect precision.
    assert stats_by_threshold[0].true_positives == 1
    assert stats_by_threshold[0].false_positives == 0
    assert stats_by_threshold[0].precision == 1.0

    # Threshold 1: both true positives now match, but so does the near-miss false
    # positive -> precision drops below the 0.99 bar.
    assert stats_by_threshold[1].true_positives == 2
    assert stats_by_threshold[1].false_positives == 1
    assert stats_by_threshold[1].precision < 0.99

    # The tool must recommend 0 here (the largest threshold still meeting min_precision),
    # not 1 or 2 -- this is the actual safety property: it should never recommend a
    # threshold it can prove creates a false positive above the target rate.
    assert recommended == 0
