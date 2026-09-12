import logging
from typing import Dict, Any
import schemas

logger = logging.getLogger(__name__)

class SentinelCameraSource:
    """
    Adapter boundary for mapping external Sentinel JSON responses into the canonical Camera schema.
    This prevents tying the core DB to external APIs, and allows future Sentinel API structural changes
    to be isolated here.
    """

    @staticmethod
    def normalize(payload: Dict[str, Any]) -> schemas.CameraCreate:
        """
        Maps a generic JSON payload (e.g., from Sentinel API) into a valid CameraCreate schema.
        Raises ValueError with clear messages for any missing required fields or invalid data
        so the bulk importer can report exactly what failed per row.
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
        if protocol not in [p.value for p in schemas.ProtocolType]:
            raise ValueError(f"Invalid protocol_type: {protocol_raw}")

        status_raw = payload.get("status")
        if not status_raw:
            raise ValueError("Missing required status")
        status = str(status_raw).upper()
        if status not in [s.value for s in schemas.CameraStatus]:
            raise ValueError(f"Invalid status: {status_raw}")

        # Parse AI enabled as boolean (defaults to False if not provided)
        ai_enabled = payload.get("ai_enabled", False)
        if isinstance(ai_enabled, str):
            ai_enabled = ai_enabled.lower() in ("true", "1", "yes")

        # Parse coordinates safely (optional fields)
        lat = payload.get("latitude")
        lng = payload.get("longitude")
        try:
            lat = float(lat) if lat is not None and str(lat).strip() else None
            lng = float(lng) if lng is not None and str(lng).strip() else None
        except ValueError:
            raise ValueError("Invalid latitude or longitude format")

        return schemas.CameraCreate(
            camera_uid=str(camera_uid),
            name=str(name),
            department=str(department),
            district=str(district),
            location=str(location),
            latitude=lat,
            longitude=lng,
            vms_vendor=str(vms_vendor),
            protocol_type=schemas.ProtocolType(protocol),
            status=schemas.CameraStatus(status),
            ai_enabled=ai_enabled,
            rtsp_url=payload.get("rtsp_url")
        )
