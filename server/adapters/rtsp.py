# Real RTSP implementation -- docs/backend.md §3.
#
# Fixed during the docs/backend.md §12.3 cleanup pass (no longer verbatim from
# contrib/aneesh/backend/adapters/rtsp.py):
#   1. TCP transport is now forced via OPENCV_FFMPEG_CAPTURE_OPTIONS (OpenCV/FFmpeg
#      default to UDP, which the hackathon's pre-submission checklist item 1 forbids).
#   2. Self-reconnect-with-backoff on both connect and read failure, mirroring
#      video/stream_manager.py's MAX_RESTARTS/backoff pattern for the FFmpeg path, so
#      this adapter no longer depends on external polling to recover from a drop.
#   3. Frame timestamps now prefer the stream's own reported position
#      (CAP_PROP_POS_MSEC) over pure local read-time -- see _resolve_timestamp()'s
#      docstring for the caveat: this is unverified against a real feed.
import os
import time
import cv2
import logging
from datetime import datetime, timedelta
from typing import Optional

from .base import CameraAdapter
from .models import NormalizedFrame
from services.error_log_service import log_adapter_error_now, opencv_version

logger = logging.getLogger(__name__)

# Must be set before any cv2.VideoCapture(..., cv2.CAP_FFMPEG) call -- OpenCV reads this
# env var at capture-open time. Global/process-wide by construction (OpenCV has no
# per-instance transport option), which is fine here: every RTSP adapter in this
# process should use TCP. Merges with, rather than clobbers, any options a caller has
# already set.
_existing_opts = os.environ.get("OPENCV_FFMPEG_CAPTURE_OPTIONS", "")
if "rtsp_transport" not in _existing_opts:
    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = (
        f"{_existing_opts}|rtsp_transport;tcp" if _existing_opts else "rtsp_transport;tcp"
    )

MAX_RECONNECT_ATTEMPTS = 3
BASE_BACKOFF_SECONDS = 2


class RTSPAdapter(CameraAdapter):
    """Real RTSP implementation using OpenCV for headless frame extraction."""

    def __init__(self, camera_uid: str, rtsp_url: str):
        self.camera_uid = camera_uid
        # The RTSP URL is kept strictly within the instance and never exposed
        self._rtsp_url = rtsp_url
        self.cap: Optional[cv2.VideoCapture] = None
        self._status = "NOT_CONFIGURED" if not rtsp_url else "CONNECTING"
        self._frame_seq = 0
        self._reconnect_attempts = 0
        self._stream_start_time: Optional[datetime] = None

    def connect(self) -> bool:
        if not self._rtsp_url:
            self._status = "NOT_CONFIGURED"
            return False

        try:
            self.cap = cv2.VideoCapture(self._rtsp_url, cv2.CAP_FFMPEG)

            if not self.cap.isOpened():
                logger.error(f"[{self.camera_uid}] RTSPAdapter failed to open stream.")
                self._status = "OFFLINE"
                log_adapter_error_now(
                    error_type="CONNECTION_FAILED",
                    camera_uid=self.camera_uid,
                    url=self._rtsp_url,
                    client_name="opencv-rtsp",
                    client_version=opencv_version(),
                    error_message="cv2.VideoCapture.isOpened() returned False",
                )
                return False

            self._status = "ACTIVE"
            self._stream_start_time = datetime.now()
            logger.info(f"[{self.camera_uid}] RTSPAdapter successfully connected.")
            return True
        except Exception as e:
            logger.error(f"[{self.camera_uid}] Exception during RTSP connect: {e}")
            self._status = "ERROR"
            log_adapter_error_now(
                error_type="CONNECTION_FAILED",
                camera_uid=self.camera_uid,
                url=self._rtsp_url,
                client_name="opencv-rtsp",
                client_version=opencv_version(),
                error_message=str(e),
            )
            return False

    def _attempt_reconnect(self) -> bool:
        """Reconnect with capped exponential backoff. Blocking (time.sleep) --
        callers on an event loop must invoke this adapter's methods via
        asyncio.to_thread, as routers/streams.py already does."""
        if self._reconnect_attempts >= MAX_RECONNECT_ATTEMPTS:
            logger.error(f"[{self.camera_uid}] Max reconnect attempts ({MAX_RECONNECT_ATTEMPTS}) reached, marking OFFLINE.")
            self._status = "OFFLINE"
            log_adapter_error_now(
                error_type="RECONNECT_EXHAUSTED",
                camera_uid=self.camera_uid,
                url=self._rtsp_url,
                client_name="opencv-rtsp",
                client_version=opencv_version(),
                error_message=f"Gave up after {MAX_RECONNECT_ATTEMPTS} reconnect attempts",
            )
            self._reconnect_attempts = 0
            return False

        self._reconnect_attempts += 1
        backoff = min(BASE_BACKOFF_SECONDS * (2 ** (self._reconnect_attempts - 1)), 30)
        logger.info(
            f"[{self.camera_uid}] Reconnecting, attempt {self._reconnect_attempts}/{MAX_RECONNECT_ATTEMPTS} in {backoff}s..."
        )
        self._status = "RECONNECTING"
        if self.cap:
            self.cap.release()
            self.cap = None
        time.sleep(backoff)
        return self.connect()

    def _resolve_timestamp(self) -> datetime:
        """Prefer the stream's own reported position (CAP_PROP_POS_MSEC) over pure
        local read-time -- docs/backend.md §2 pre-submission checklist item 2: the
        hackathon's simulated feeds are synchronized onto a common timeline, not
        real-time. CAP_PROP_POS_MSEC is stream-relative, not epoch, so it's anchored
        to this adapter's own connect-time wall clock rather than converted directly.

        CAVEAT: unverified against a real feed -- none exists to test against yet.
        Live RTSP backends commonly report 0/unsupported for this property, in which
        case this silently falls back to local time, same as before this fix.
        """
        pos_msec = self.cap.get(cv2.CAP_PROP_POS_MSEC) if self.cap else 0
        if pos_msec and pos_msec > 0 and self._stream_start_time:
            return self._stream_start_time + timedelta(milliseconds=pos_msec)
        return datetime.now()

    def read_frame(self) -> Optional[NormalizedFrame]:
        if not self.cap or not self.cap.isOpened():
            if not self._attempt_reconnect():
                return None

        ret, frame = self.cap.read()
        if not ret or frame is None:
            logger.warning(f"[{self.camera_uid}] Failed to read frame from RTSP stream.")
            if not self._attempt_reconnect():
                return None
            ret, frame = self.cap.read()
            if not ret or frame is None:
                self._status = "DEGRADED"
                return None

        self._status = "ACTIVE"
        self._reconnect_attempts = 0
        self._frame_seq += 1
        height, width = frame.shape[:2]

        return NormalizedFrame(
            camera_uid=self.camera_uid,
            frame=frame,
            timestamp=self._resolve_timestamp(),
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
        self._reconnect_attempts = 0
        logger.info(f"[{self.camera_uid}] RTSPAdapter closed.")
