# Normalizes external camera catalogue payloads into the canonical CameraCreate schema --
# docs/backend.md §5 Pipeline 1 (API-based onboarding). Ported from
# contrib/aneesh/backend/integration/discovery_adapter.py, import paths adapted to the
# schemas/ package. Despite the module name (kept for continuity with the original
# migration), this is the JSON/CSV-payload normalizer used by the bulk importers in
# routers/cameras.py -- true network/WS-Discovery auto-onboarding is still unbuilt
# (docs/backend.md §3).
import logging
from typing import Dict, Any

from schemas.camera import CameraCreate, ProtocolType, CameraStatus

logger = logging.getLogger(__name__)


class SentinelCameraSource:
    """
    Adapter boundary for mapping external catalogue JSON (e.g. the hackathon's
    /api/ingest response, docs/backend.md §2) into the canonical Camera schema. This
    isolates the core DB from external API shape changes to this one module.
    """

    @staticmethod
    def normalize(payload: Dict[str, Any]) -> CameraCreate:
        """
        Maps a generic JSON payload into a valid CameraCreate schema. Raises ValueError
        with clear messages for any missing/invalid field so the bulk importer can
        report exactly what failed per row.
        """
        camera_uid = payload.get("camera_uid") or payload.get("id") or payload.get("camera_id")
        if not camera_uid:
            raise ValueError("Missing unique camera identifier")

        name = payload.get("name")
        if not name:
            raise ValueError("Missing required name")

        department = payload.get("department")
        if not department:
            raise ValueError("Missing required department")

        district = payload.get("district")
        if not district:
            raise ValueError("Missing required district")

        location = payload.get("location")
        if not location:
            raise ValueError("Missing required location")

        vms_vendor = payload.get("vms_vendor")
        if not vms_vendor:
            raise ValueError("Missing required vms_vendor")

        protocol_raw = payload.get("protocol_type")
        if not protocol_raw:
            raise ValueError("Missing required protocol_type")
        protocol = str(protocol_raw).upper()
        if protocol not in [p.value for p in ProtocolType]:
            raise ValueError(f"Invalid protocol_type: {protocol_raw}")

        status_raw = payload.get("status")
        if not status_raw:
            raise ValueError("Missing required status")
        status = str(status_raw).upper()
        if status not in [s.value for s in CameraStatus]:
            raise ValueError(f"Invalid status: {status_raw}")

        ai_enabled = payload.get("ai_enabled", False)
        if isinstance(ai_enabled, str):
            ai_enabled = ai_enabled.lower() in ("true", "1", "yes")

        lat = payload.get("latitude")
        lng = payload.get("longitude")
        try:
            lat = float(lat) if lat is not None and str(lat).strip() else None
            lng = float(lng) if lng is not None and str(lng).strip() else None
        except ValueError:
            raise ValueError("Invalid latitude or longitude format")

        return CameraCreate(
            camera_uid=str(camera_uid),
            name=str(name),
            department=str(department),
            district=str(district),
            location=str(location),
            latitude=lat,
            longitude=lng,
            vms_vendor=str(vms_vendor),
            protocol_type=ProtocolType(protocol),
            status=CameraStatus(status),
            ai_enabled=ai_enabled,
            rtsp_url=payload.get("rtsp_url"),
        )
