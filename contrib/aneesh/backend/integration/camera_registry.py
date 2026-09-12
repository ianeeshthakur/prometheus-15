import os
from pydantic import BaseModel
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

class CameraConfig(BaseModel):
    id: str
    name: str
    location: str
    district: str
    rtsp_url: str  # internal, NEVER EXPOSED TO FRONTEND
    source_type: str
    ai_enabled: bool

class CameraRegistry:
    def __init__(self):
        self.cameras: Dict[str, CameraConfig] = {}
        self._load_from_env()

    def _load_from_env(self):
        """Loads sentinel configuration from environment securely."""
        mode = os.environ.get("MODE", "DEMO")
        if mode != "LIVE":
            return

        username = os.environ.get("SENTINEL_RTSP_USERNAME", "admin")
        password = os.environ.get("SENTINEL_RTSP_PASSWORD", "password")
        host = os.environ.get("SENTINEL_HOST", "192.168.1.100")
        port = os.environ.get("SENTINEL_PORT", "554")
        path = os.environ.get("SENTINEL_PATH", "stream1")

        # Construct full RTSP URL
        rtsp_url = f"rtsp://{username}:{password}@{host}:{port}/{path}"

        # Register our first live camera
        cam_id = "CAM-GJ-SRT-00421"
        self.cameras[cam_id] = CameraConfig(
            id=cam_id,
            name="Surat Ring Road Entry",
            location="Surat Ring Road",
            district="Surat",
            rtsp_url=rtsp_url,
            source_type="SENTINEL_RTSP",
            ai_enabled=True
        )
        logger.info(f"Loaded configuration for {cam_id}")

    def get_all(self) -> List[Dict]:
        """Returns safe camera definitions without credentials."""
        safe_cams = []
        for cam in self.cameras.values():
            safe_cams.append({
                "id": cam.id,
                "name": cam.name,
                "location": cam.location,
                "district": cam.district,
                "source_type": cam.source_type,
                "ai_enabled": cam.ai_enabled
            })
        return safe_cams

    def get_rtsp_url(self, camera_id: str) -> Optional[str]:
        """Internal method to get the RTSP URL for streaming."""
        if camera_id in self.cameras:
            return self.cameras[camera_id].rtsp_url
        return None

# Singleton
camera_registry = CameraRegistry()
