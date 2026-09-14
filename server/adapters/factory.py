# Adapter factory -- docs/backend.md §1/§5 Pipeline 2. Ported from
# contrib/aneesh/backend/adapters/factory.py, with the legacy in-memory
# `camera_registry` fallback removed: that module simulated one hardcoded demo camera
# from env vars and is superseded here by the DB-backed registry (Model 1) as the single
# source of truth -- see docs/prd.md §15 decision log. The real ingest-API catalogue sync
# (docs/backend.md §2) is what should populate the DB going forward, not an in-memory
# shadow registry.
import logging
from sqlalchemy.orm import Session

from services import camera_service
from .base import CameraAdapter
from .rtsp import RTSPAdapter
from .hls import HLSAdapter
from .onvif import ONVIFAdapter
from .vendor import VendorSDKAdapter
from schemas.camera import ProtocolType

logger = logging.getLogger(__name__)


class AdapterFactory:
    """
    Centralized factory for resolving the correct CameraAdapter.
    Fetches the camera configuration securely from the database and
    instantiates the proper protocol adapter without leaking credentials.
    """

    @staticmethod
    def get_camera_adapter(camera_uid: str, db: Session) -> CameraAdapter:
        db_cam = camera_service.get_camera_by_uid(db, camera_uid)
        if not db_cam:
            raise ValueError(f"Camera {camera_uid} not found in registry.")

        protocol = db_cam.protocol_type
        connection_string = db_cam.rtsp_url or ""

        if protocol == ProtocolType.RTSP.value:
            return RTSPAdapter(camera_uid, connection_string)
        elif protocol == ProtocolType.HLS.value:
            return HLSAdapter(camera_uid, connection_string)
        elif protocol == ProtocolType.ONVIF.value:
            return ONVIFAdapter(camera_uid, connection_string)
        elif protocol == ProtocolType.VENDOR_SDK.value:
            return VendorSDKAdapter(camera_uid, connection_string)
        else:
            raise ValueError(f"Unsupported protocol type: {protocol} for camera {camera_uid}")
