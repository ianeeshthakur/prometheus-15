import cv2
import logging
from datetime import datetime
from typing import Optional

from .base import CameraAdapter
from .models import NormalizedFrame

logger = logging.getLogger(__name__)

class RTSPAdapter(CameraAdapter):
    """Real RTSP implementation using OpenCV for headless frame extraction."""

    def __init__(self, camera_uid: str, rtsp_url: str):
        self.camera_uid = camera_uid
        # The RTSP URL is kept strictly within the instance and never exposed
        self._rtsp_url = rtsp_url
        self.cap: Optional[cv2.VideoCapture] = None
        self._status = "NOT_CONFIGURED" if not rtsp_url else "CONNECTING"
        self._frame_seq = 0

    def connect(self) -> bool:
        if not self._rtsp_url:
            self._status = "NOT_CONFIGURED"
            return False

        try:
            # Configure OpenCV to aggressively timeout if stream is dead
            # We don't want to block the thread forever
            os_environ_backup = None # usually we'd set OPENCV_FFMPEG_CAPTURE_OPTIONS here

            self.cap = cv2.VideoCapture(self._rtsp_url, cv2.CAP_FFMPEG)

            # Fast check
            if not self.cap.isOpened():
                logger.error(f"[{self.camera_uid}] RTSPAdapter failed to open stream.")
                self._status = "OFFLINE"
                return False

            self._status = "ACTIVE"
            logger.info(f"[{self.camera_uid}] RTSPAdapter successfully connected.")
            return True
        except Exception as e:
            logger.error(f"[{self.camera_uid}] Exception during RTSP connect: {e}")
            self._status = "ERROR"
            return False

    def read_frame(self) -> Optional[NormalizedFrame]:
        if not self.cap or not self.cap.isOpened():
            self._status = "OFFLINE"
            return None

        ret, frame = self.cap.read()
        if not ret or frame is None:
            logger.warning(f"[{self.camera_uid}] Failed to read frame from RTSP stream.")
            self._status = "DEGRADED"
            return None

        self._status = "ACTIVE"
        self._frame_seq += 1
        height, width = frame.shape[:2]

        return NormalizedFrame(
            camera_uid=self.camera_uid,
            frame=frame,
            timestamp=datetime.now(),
            width=width,
            height=height,
            source_protocol="RTSP",
            frame_sequence=self._frame_seq
        )

    def health_check(self) -> str:
        return self._status

    def close(self) -> None:
        if self.cap:
            self.cap.release()
            self.cap = None
        self._status = "OFFLINE"
        logger.info(f"[{self.camera_uid}] RTSPAdapter closed.")
