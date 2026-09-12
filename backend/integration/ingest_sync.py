# Syncs the camera registry from the hackathon's real /api/ingest catalogue --
# docs/backend.md §2/§12.4. Previously nothing called this endpoint at all.
#
# UNVERIFIED against the real hackathon infrastructure: INGEST_API_BASE_URL is unset
# by default (core/config.py) since organizers haven't published a live host as of
# this writing. This will raise a clear, honest error rather than silently doing
# nothing or fabricating cameras when unconfigured -- see sync_from_ingest_api()'s
# ValueError below.
import logging
from typing import Dict
import requests
from sqlalchemy.orm import Session

from core.config import INGEST_API_BASE_URL
from integration.discovery_adapter import SentinelCameraSource
from services import camera_service
from schemas.camera import ImportSummaryResponse

logger = logging.getLogger(__name__)


def sync_from_ingest_api(db: Session, timeout_seconds: int = 15) -> ImportSummaryResponse:
    """Fetches GET {INGEST_API_BASE_URL}/api/ingest and upserts every camera in the
    catalogue via the same idempotent path the manual JSON import uses. Reuses
    SentinelCameraSource.normalize() -- the ingest API's exact payload shape isn't
    documented beyond "camera id, location, codec, live status, stream properties, and
    all three stream URLs" (docs/backend.md §2), so this normalizer's flexible field
    lookups (`camera_uid` or `id` or `camera_id`, etc.) are the best available bet until
    a real payload can be inspected -- expect to adjust field names once one is."""
    if not INGEST_API_BASE_URL:
        raise ValueError(
            "INGEST_API_BASE_URL is not configured -- set it in .env once the hackathon "
            "publishes a live host for the simulated feed catalogue (docs/backend.md §2)."
        )

    url = f"{INGEST_API_BASE_URL.rstrip('/')}/api/ingest"
    logger.info(f"Fetching camera catalogue from {url}")
    resp = requests.get(url, timeout=timeout_seconds)
    resp.raise_for_status()
    payload = resp.json()

    # Accept either a bare list or a {"cameras": [...]} wrapper -- exact shape unverified.
    catalogue = payload.get("cameras", payload) if isinstance(payload, dict) else payload
    if not isinstance(catalogue, list):
        raise ValueError(f"Unexpected /api/ingest response shape: {type(payload)}")

    total = len(catalogue)
    created = duplicates = failed = 0
    errors = []

    for idx, item in enumerate(catalogue):
        try:
            cam_data = SentinelCameraSource.normalize(_map_ingest_fields(item))
            _, is_created = camera_service.upsert_camera(db, cam_data)
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
    placeholders rather than guessed real values -- update this once a real payload is
    seen."""
    mapped = dict(item)
    mapped.setdefault("department", "UNKNOWN")
    mapped.setdefault("vms_vendor", "HACKATHON_INGEST")
    mapped.setdefault("protocol_type", "RTSP")  # RTSP is the AI-inference stream per docs/backend.md §2
    mapped.setdefault("status", "ACTIVE" if item.get("live_status", True) else "OFFLINE")
    if "rtsp_url" not in mapped and "rtsp" in item:
        mapped["rtsp_url"] = item["rtsp"]
    return mapped
