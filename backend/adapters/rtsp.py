# Real RTSP implementation -- docs/backend.md §3. Ported verbatim from
# contrib/aneesh/backend/adapters/rtsp.py (no changes needed).
#
# NOTE: this is headless single-frame OpenCV capture (health checks, on-demand AI
# analysis). It is NOT yet consuming the real ingest API over TCP end-to-end the way
# video/ffmpeg_runner.py does (which explicitly passes -rtsp_transport tcp) -- see
# docs/backend.md §2's pre-submission checklist item 1. Confirm cv2.VideoCapture is
# also forced to TCP (via OPENCV_FFMPEG_CAPTURE_OPTIONS env var) before relying on this
# for the real hackathon feeds; UDP is the OpenCV/FFmpeg default and will not satisfy
# the checklist as-is.
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
            self.cap = cv2.VideoCapture(self._rtsp_url, cv2.CAP_FFMPEG)

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
            frame_sequence=self._frame_seq,
        )

    def health_check(self) -> str:
        return self._status

    def close(self) -> None:
        if self.cap:
            self.cap.release()
            self.cap = None
        self._status = "OFFLINE"
        logger.info(f"[{self.camera_uid}] RTSPAdapter closed.")
