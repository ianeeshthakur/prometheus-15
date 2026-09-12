# Integration test for docs/backend.md §12.3's watchlist-matching fix: creates a real
# watchlist entry, feeds a matching event through the real AlertEngine, and confirms a
# watchlist alert (not a plain event) comes out, with match_count actually incrementing.
# Run with the backend already up (`uvicorn main:app`).
import asyncio
import requests
import time
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = "http://localhost:8000/api/watchlists"


def wait_for_server():
    for _ in range(10):
        try:
            requests.get("http://localhost:8000/")
            return True
        except requests.exceptions.ConnectionError:
            time.sleep(1)
    return False


if not wait_for_server():
    print("Server did not start")
    exit(1)

print("\n--- Watchlist matching tests ---\n")

print("1. Creating a watchlist entry...")
entry = {
    "identifier": "GJ01AB4521",
    "category": "STOLEN_VEHICLE",
    "description": "Reported stolen 2026-09-10",
    "risk_level": "CRITICAL",
    "source": "Test",
    "added_by": "tester",
}
resp = requests.post(f"{BASE_URL}/", json=entry)
print(resp.status_code, resp.json())
assert resp.status_code == 201
data = resp.json()
assert data["match_count"] == 0
entry_id = data["id"]
print("   PASS")

print("2. Listing watchlist...")
resp = requests.get(f"{BASE_URL}/")
assert resp.status_code == 200
assert any(e["identifier"] == "GJ01AB4521" for e in resp.json())
print("   PASS")

print("3. Feeding a matching event through the real AlertEngine (in-process, not via HTTP)...")
# The AlertEngine is in-process state (module-level singleton), so this exercises it
# directly rather than through an HTTP endpoint -- there is no HTTP endpoint that
# accepts a raw event yet (that's routers/streams.py's AI pipeline's job, which needs a
# live camera + ffmpeg to drive).
from intelligence.alert_engine import alert_engine  # noqa: E402
from intelligence.events import NormalizedEvent  # noqa: E402


async def run():
    received = []
    queue = asyncio.Queue()
    alert_engine.subscribe(queue)

    matching_event = NormalizedEvent(
        camera_id="CAM-TEST-WATCHLIST",
        event_type="PLATE_RECOGNIZED",
        object_type="VEHICLE",
        confidence=0.91,
        plate_number="GJ01AB4521",
        location="Test Location",
        district="Ahmedabad",
    )
    await alert_engine.process_event(matching_event)
    received.append(await queue.get())

    non_matching_event = NormalizedEvent(
        camera_id="CAM-TEST-WATCHLIST",
        event_type="PLATE_RECOGNIZED",
        object_type="VEHICLE",
        confidence=0.91,
        plate_number="GJ99ZZ0000",
        location="Test Location",
        district="Ahmedabad",
    )
    await alert_engine.process_event(non_matching_event)
    received.append(await queue.get())

    alert_engine.unsubscribe(queue)
    return received


results = asyncio.run(run())

assert results[0]["type"] == "alert", f"Expected a watchlist alert, got: {results[0]}"
assert results[0]["data"]["severity"] == "CRITICAL"
assert results[0]["data"]["watchlist_entry_id"] == entry_id
print("   PASS -- matching plate produced a real watchlist alert, not a hardcoded check")

assert results[1]["type"] == "event", f"Expected a plain event for a non-matching plate, got: {results[1]}"
print("   PASS -- non-matching plate produced a plain event, no false alert")

print("4. Confirming match_count incremented...")
resp = requests.get(f"{BASE_URL}/")
entry_after = next(e for e in resp.json() if e["id"] == entry_id)
print(entry_after)
assert entry_after["match_count"] == 1
print("   PASS")

print("\nAll watchlist matching tests passed!")
