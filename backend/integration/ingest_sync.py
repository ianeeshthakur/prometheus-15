# Syncs the camera registry from the hackathon's real /api/ingest catalogue --
# docs/backend.md §2/§12.4/§12.7. Previously nothing called this endpoint at all.
#
# UNVERIFIED against the real hackathon infrastructure: INGEST_API_BASE_URL is unset
# by default (core/config.py) since organizers haven't published a live host as of
# this writing. This will raise a clear, honest error rather than silently doing
# nothing or fabricating cameras when unconfigured -- see sync_from_ingest_api()'s
# ValueError below.
#
# What §12.7's cleanup pass actually changed here, since the real payload shape is
# still unknown: made the guess CHEAP TO FIX once it's wrong, instead of pretending
# it's already right.
#   1. preview_ingest_catalogue() -- fetches and returns the RAW, unmodified response
#      (no normalization, no DB writes) so a human can inspect the real field names the
#      moment a host is configured, before trusting sync_from_ingest_api() with writes.
#   2. INGEST_FIELD_ALIASES (core/config.py) -- a JSON env var mapping the catalogue's
#      real key names to CameraCreate's field names. If the real payload uses e.g.
#      "vendor" instead of "vms_vendor", that's now a config change (set the env var
#      and restart), not a code change.
import logging
from typing import Any, Dict
import requests
from sqlalchemy.orm import Session

from core.config import INGEST_API_BASE_URL, INGEST_FIELD_ALIASES
from integration.discovery_adapter import SentinelCameraSource
from services import camera_service
from schemas.camera import ImportSummaryResponse

logger = logging.getLogger(__name__)


def _fetch_catalogue(timeout_seconds: int = 15) -> Any:
    if not INGEST_API_BASE_URL:
        raise ValueError(
            "INGEST_API_BASE_URL is not configured -- set it in .env once the hackathon "
            "publishes a live host for the simulated feed catalogue (docs/backend.md §2)."
        )
    url = f"{INGEST_API_BASE_URL.rstrip('/')}/api/ingest"
    logger.info(f"Fetching camera catalogue from {url}")
    resp = requests.get(url, timeout=timeout_seconds)
    resp.raise_for_status()
    return resp.json()


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
    return mapped
