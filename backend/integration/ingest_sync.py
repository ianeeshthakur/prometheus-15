# Syncs the camera registry from a real ingest catalogue -- docs/backend.md
# §2/§12.4/§12.7. Previously nothing called this endpoint at all.
#
# Two real catalogue shapes are now supported, since two different real things have
# turned up so far and they aren't the same contract:
#   1. The documented official-portal contract: GET {INGEST_API_BASE_URL}/api/ingest.
#      Still unverified -- no live host published for this one as of this writing.
#   2. A real hackathon test rig at corp8.cloud (found 2026-09-13): a flat GET at a
#      fixed URL (INGEST_CATALOGUE_URL, e.g. https://cctv.corp8.cloud/cameras.json),
#      not a path under a configurable base. RTSP access on this rig needs a
#      registered email+password embedded in the connection URL -- see
#      _build_authenticated_rtsp_url() below. Both fail clearly and honestly (see
#      _fetch_catalogue()'s ValueError) rather than silently doing nothing or
#      fabricating cameras when unconfigured.
#
# What §12.7's cleanup pass changed here, since even the corp8.cloud payload's exact
# field names are still unobserved from inside this sandbox (outbound requests to it
# are blocked by this environment's own safety layer -- see docs/backend.md §12.7):
# made the guess CHEAP TO FIX once it's wrong, instead of pretending it's already right.
#   1. preview_ingest_catalogue() -- fetches and returns the RAW, unmodified response
#      (no normalization, no DB writes) so a human can inspect the real field names the
#      moment this runs somewhere that can actually reach the host, before trusting
#      sync_from_ingest_api() with writes.
#   2. INGEST_FIELD_ALIASES (core/config.py) -- a JSON env var mapping the catalogue's
#      real key names to CameraCreate's field names. If the real payload uses e.g.
#      "vendor" instead of "vms_vendor", that's now a config change (set the env var
#      and restart), not a code change.
import logging
from typing import Any, Dict, Optional
from urllib.parse import quote
import requests
from sqlalchemy.orm import Session

from core.config import (
    INGEST_API_BASE_URL,
    INGEST_CATALOGUE_URL,
    INGEST_FIELD_ALIASES,
    INGEST_STREAM_EMAIL,
    INGEST_STREAM_PASSWORD,
    INGEST_RTSP_HOST,
    INGEST_RTSP_PORT,
)
from integration.discovery_adapter import SentinelCameraSource
from services import camera_service
from schemas.camera import ImportSummaryResponse

logger = logging.getLogger(__name__)


def _fetch_catalogue(timeout_seconds: int = 15) -> Any:
    if INGEST_CATALOGUE_URL:
        url = INGEST_CATALOGUE_URL
    elif INGEST_API_BASE_URL:
        url = f"{INGEST_API_BASE_URL.rstrip('/')}/api/ingest"
    else:
        raise ValueError(
            "Neither INGEST_CATALOGUE_URL nor INGEST_API_BASE_URL is configured -- set "
            "one in .env once a live catalogue host is reachable (docs/backend.md §2/§12.7)."
        )
    logger.info(f"Fetching camera catalogue from {url}")
    resp = requests.get(url, timeout=timeout_seconds)
    resp.raise_for_status()
    return resp.json()


def _build_authenticated_rtsp_url(camera_id: str) -> Optional[str]:
    """Synthesizes the real, credentialed RTSP URL for one camera on the corp8.cloud
    rig (docs/backend.md §12.7): rtsp://<email>:<password>@<host>:<port>/stream/<id>.
    Returns None -- not a guess -- when the stream credentials/host aren't configured,
    so a camera missing this config fails loudly downstream (no rtsp_url to connect
    with) rather than silently getting a URL that can't possibly work. Email/password
    are percent-encoded (`quote(..., safe="")`) since userinfo can't contain a raw
    "@" or other reserved characters -- the real doc's own example shows this for the
    email (`%40` for `@`)."""
    if not (INGEST_STREAM_EMAIL and INGEST_STREAM_PASSWORD and INGEST_RTSP_HOST):
        return None
    email = quote(INGEST_STREAM_EMAIL, safe="")
    password = quote(INGEST_STREAM_PASSWORD, safe="")
    return f"rtsp://{email}:{password}@{INGEST_RTSP_HOST}:{INGEST_RTSP_PORT}/stream/{camera_id}"


def preview_ingest_catalogue(timeout_seconds: int = 15) -> Any:
    """Fetches the real catalogue AS-IS -- no normalization, no DB writes. This is the
    tool for the moment a real host exists: run this first, look at the actual field
    names, then set INGEST_FIELD_ALIASES (or, if the shape is stranger than a rename,
    edit _map_ingest_fields below) before ever calling sync_from_ingest_api() for real."""
    return _fetch_catalogue(timeout_seconds)


def sync_from_ingest_api(db: Session, timeout_seconds: int = 15) -> ImportSummaryResponse:
    """Fetches GET {INGEST_API_BASE_URL}/api/ingest and upserts every camera in the
    catalogue via the same idempotent path the manual JSON import uses. Reuses
    SentinelCameraSource.normalize() -- the ingest API's exact payload shape isn't
    documented beyond "camera id, location, codec, live status, stream properties, and
    all three stream URLs" (docs/backend.md §2), so this normalizer's flexible field
    lookups (`camera_uid` or `id` or `camera_id`, etc.) plus INGEST_FIELD_ALIASES are
    the best available bet until a real payload can be inspected -- see
    preview_ingest_catalogue() to do that first."""
    payload = _fetch_catalogue(timeout_seconds)

    # Accept either a bare list or a {"cameras": [...]} wrapper -- exact shape unverified.
    catalogue = payload.get("cameras", payload) if isinstance(payload, dict) else payload
    if not isinstance(catalogue, list):
        raise ValueError(f"Unexpected /api/ingest response shape: {type(payload)}")

    if catalogue:
        # Logged, not silently discarded -- the fastest way to notice the guessed
        # mapping is wrong is seeing the raw shape land in the logs the first time
        # this actually runs against a real host.
        logger.info(f"First raw ingest catalogue item (unmapped): {catalogue[0]}")

    total = len(catalogue)
    created = duplicates = failed = 0
    errors = []

    for idx, item in enumerate(catalogue):
        try:
            cam_data = SentinelCameraSource.normalize(_map_ingest_fields(item))
            _, is_created = camera_service.upsert_camera(db, cam_data, onboarding_source="API_INGEST")
            if is_created:
                created += 1
            else:
                duplicates += 1
        except Exception as e:
            failed += 1
            errors.append(f"Camera at index {idx} failed: {str(e)}")

    return ImportSummaryResponse(total_rows=total, created=created, duplicates=duplicates, failed=failed, errors=errors)


def _map_ingest_fields(item: Dict) -> Dict:
    """Best-effort mapping from the documented /api/ingest fields (id, location, codec,
    live status, stream properties, stream URLs) to CameraCreate's required fields.
    Fields the catalogue doesn't provide (department, vms_vendor) get honest
    placeholders rather than guessed real values.

    Rename fixes go in INGEST_FIELD_ALIASES (a config change); anything structurally
    different (e.g. nested objects instead of flat keys) still needs a code change
    here -- an env var can't fix a shape mismatch, only a name mismatch."""
    mapped = dict(item)

    for source_key, target_key in INGEST_FIELD_ALIASES.items():
        if source_key in mapped and target_key not in mapped:
            mapped[target_key] = mapped[source_key]

    mapped.setdefault("department", "UNKNOWN")
    mapped.setdefault("vms_vendor", "HACKATHON_INGEST")
    mapped.setdefault("protocol_type", "RTSP")  # RTSP is the AI-inference stream per docs/backend.md §2
    mapped.setdefault("status", "ACTIVE" if item.get("live_status", True) else "OFFLINE")
    if "rtsp_url" not in mapped and "rtsp" in item:
        mapped["rtsp_url"] = item["rtsp"]

    # The corp8.cloud rig's catalogue almost certainly doesn't hand back a working
    # authenticated URL directly (docs/backend.md §12.7) -- synthesize one from the
    # configured stream credentials if the payload didn't already provide one.
    if not mapped.get("rtsp_url"):
        camera_id = mapped.get("camera_uid") or mapped.get("id") or mapped.get("camera_id")
        if camera_id:
            synthesized = _build_authenticated_rtsp_url(str(camera_id))
            if synthesized:
                mapped["rtsp_url"] = synthesized

    return mapped
