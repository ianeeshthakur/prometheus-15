# HLSAdapter -- docs/backend.md §3. Ported verbatim from contrib/aneesh/backend/adapters/hls.py.
import cv2
import logging
from datetime import datetime
from typing import Optional

from .base import CameraAdapter
from .models import NormalizedFrame

logger = logging.getLogger(__name__)


class HLSAdapter(CameraAdapter):
    """Decodes HTTP Live Streaming (.m3u8) feeds into the same NormalizedFrame shape as RTSP."""

    def __init__(self, camera_uid: str, stream_url: str):
        self.camera_uid = camera_uid
        self._stream_url = stream_url
        self.cap: Optional[cv2.VideoCapture] = None
        self._status = "NOT_CONFIGURED" if not stream_url else "CONNECTING"
        self._frame_seq = 0

    def connect(self) -> bool:
        if not self._stream_url:
            self._status = "NOT_CONFIGURED"
            return False

        try:
            # OpenCV FFmpeg backend natively supports HLS/m3u8 urls
            self.cap = cv2.VideoCapture(self._stream_url, cv2.CAP_FFMPEG)

            if not self.cap.isOpened():
                logger.error(f"[{self.camera_uid}] HLSAdapter failed to open stream.")
                self._status = "OFFLINE"
                return False

            self._status = "ACTIVE"
            logger.info(f"[{self.camera_uid}] HLSAdapter successfully connected.")
            return True
        except Exception as e:
            logger.error(f"[{self.camera_uid}] Exception during HLS connect: {e}")
            self._status = "ERROR"
            return False

    def read_frame(self) -> Optional[NormalizedFrame]:
        if not self.cap or not self.cap.isOpened():
            self._status = "OFFLINE"
            return None

        ret, frame = self.cap.read()
        if not ret or frame is None:
            logger.warning(f"[{self.camera_uid}] Failed to read frame from HLS stream.")
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
            source_protocol="HLS",
            frame_sequence=self._frame_seq,
        )

    def health_check(self) -> str:
        return self._status

    def close(self) -> None:
        if self.cap:
            self.cap.release()
            self.cap = None
        self._status = "OFFLINE"
        logger.info(f"[{self.camera_uid}] HLSAdapter closed.")
