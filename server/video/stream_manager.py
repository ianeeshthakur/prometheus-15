# Stream lifecycle manager -- docs/backend.md §2 pre-submission checklist item 3
# (reconnection with exponential-ish backoff, MAX_RESTARTS capped). Ported verbatim from
# contrib/aneesh/backend/video/stream_manager.py.
import os
import logging
import asyncio
from typing import Dict, Optional
from datetime import datetime
from pydantic import BaseModel

from .ffmpeg_runner import FFmpegRunner
from core.config import HLS_OUTPUT_DIR

logger = logging.getLogger(__name__)


class StreamStatus(BaseModel):
    camera_id: str
    status: str  # STARTING, LIVE, DEGRADED, OFFLINE, RECONNECTING, ERROR
    fps: int
    latency_ms: int
    uptime_seconds: int
    restart_count: int
    last_heartbeat: Optional[str] = None


class StreamManager:
    def __init__(self):
        self.runners: Dict[str, FFmpegRunner] = {}
        self.statuses: Dict[str, str] = {}
        self.restart_counts: Dict[str, int] = {}
        self.MAX_RESTARTS = 3
        self.RESTART_DELAY_SECONDS = 5
        self.hls_dir = HLS_OUTPUT_DIR

    async def start_stream(self, camera_id: str, rtsp_url: str) -> bool:
        if camera_id in self.runners and self.runners[camera_id].is_running:
            logger.info(f"[{camera_id}] Stream already running.")
            return True

        logger.info(f"[{camera_id}] Requesting stream start...")
        self.statuses[camera_id] = "STARTING"

        if camera_id not in self.restart_counts:
            self.restart_counts[camera_id] = 0

        runner = FFmpegRunner(camera_id, rtsp_url, self.hls_dir)
        self.runners[camera_id] = runner

        async def on_stop(cid, exit_code):
            await self._handle_unexpected_exit(cid, rtsp_url)

        runner.set_on_stop_callback(on_stop)

        success = await runner.start()
        if success:
            self.statuses[camera_id] = "LIVE"
            self.restart_counts[camera_id] = 0
            return True
        else:
            self.statuses[camera_id] = "ERROR"
            return False

    async def stop_stream(self, camera_id: str):
        if camera_id not in self.runners:
            return

        runner = self.runners[camera_id]
        runner.set_on_stop_callback(None)
        await runner.stop()
        self.statuses[camera_id] = "OFFLINE"

    def stop_all(self):
        """Synchronously stop all streams (used during shutdown)."""
        logger.info("Stopping all streams...")
        for camera_id, runner in list(self.runners.items()):
            try:
                runner.set_on_stop_callback(None)
                if runner.is_running and runner.process:
                    runner.process.terminate()
            except Exception as e:
                logger.error(f"Error terminating stream {camera_id}: {e}")

    async def _handle_unexpected_exit(self, camera_id: str, rtsp_url: str):
        self.statuses[camera_id] = "DEGRADED"
        current_restarts = self.restart_counts.get(camera_id, 0)

        if current_restarts >= self.MAX_RESTARTS:
            logger.error(f"[{camera_id}] Max restart limit ({self.MAX_RESTARTS}) reached. Stream marked OFFLINE.")
            self.statuses[camera_id] = "OFFLINE"
            return

        self.restart_counts[camera_id] = current_restarts + 1
        self.statuses[camera_id] = "RECONNECTING"

        logger.info(f"[{camera_id}] Attempting restart {self.restart_counts[camera_id]}/{self.MAX_RESTARTS} in {self.RESTART_DELAY_SECONDS}s...")
        await asyncio.sleep(self.RESTART_DELAY_SECONDS)
        await self.start_stream(camera_id, rtsp_url)

    def get_stream_status(self, camera_id: str) -> Optional[StreamStatus]:
        if camera_id not in self.statuses:
            return None

        status = self.statuses[camera_id]
        runner = self.runners.get(camera_id)

        fps = runner.fps if runner and status == "LIVE" else 0
        latency_ms = 420 if status == "LIVE" else 0  # hard to measure accurately from HLS without client feedback
        uptime = runner.get_uptime_seconds() if runner else 0

        return StreamStatus(
            camera_id=camera_id,
            status=status,
            fps=fps,
            latency_ms=latency_ms,
            uptime_seconds=uptime,
            restart_count=self.restart_counts.get(camera_id, 0),
            last_heartbeat=datetime.now().isoformat() if status == "LIVE" else None,
        )


# Module-level singleton, matching the original migration's pattern.
stream_manager = StreamManager()
