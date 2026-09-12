import logging
from sqlalchemy.orm import Session

from services import camera_service
from .base import CameraAdapter
from .rtsp import RTSPAdapter
from .hls import HLSAdapter
from .onvif import ONVIFAdapter
from .vendor import VendorSDKAdapter
import schemas

logger = logging.getLogger(__name__)

class AdapterFactory:
    """
    Centralized factory for resolving the correct CameraAdapter.
    Fetches the camera configuration securely from the database and 
    instantiates the proper protocol adapter without leaking credentials.
    """
    
    @staticmethod
    def get_camera_adapter(camera_uid: str, db: Session) -> CameraAdapter:
        # First, try to fetch the camera from the database
        db_cam = camera_service.get_camera_by_uid(db, camera_uid)
        
        if db_cam:
            protocol = db_cam.protocol_type
            connection_string = db_cam.rtsp_url or ""
        else:
            raise ValueError(f"Camera {camera_uid} not found in database.")
            
        if protocol == schemas.ProtocolType.RTSP.value:
            return RTSPAdapter(camera_uid, connection_string)
        elif protocol == schemas.ProtocolType.HLS.value:
            return HLSAdapter(camera_uid, connection_string)
        elif protocol == schemas.ProtocolType.ONVIF.value:
            return ONVIFAdapter(camera_uid, connection_string)
        elif protocol == schemas.ProtocolType.VENDOR_SDK.value:
            return VendorSDKAdapter(camera_uid, connection_string)
        else:
            raise ValueError(f"Unsupported protocol type: {protocol} for camera {camera_uid}")
