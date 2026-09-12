# Rate-limits frame reads to AI_TARGET_FPS instead of pulling every available frame --
# docs/ai_pipelines.md §1, docs/backend.md §12.4. Built to replace routers/streams.py's
# inline `asyncio.sleep(1/5)` with a reusable, testable component.
import time
import logging
from typing import Optional

from adapters.base import CameraAdapter
from adapters.models import NormalizedFrame
from ai.config import AI_TARGET_FPS

logger = logging.getLogger(__name__)


class FrameSampler:
    """Wraps a CameraAdapter and paces read_frame() calls to at most `target_fps`,
    sleeping just enough to hit the interval rather than reading as fast as the
    adapter allows. Blocking, like the underlying adapter -- call via
    asyncio.to_thread from async code, same as adapter.read_frame() itself."""

    def __init__(self, adapter: CameraAdapter, target_fps: float = AI_TARGET_FPS):
        self.adapter = adapter
        self.min_interval = 1.0 / target_fps if target_fps > 0 else 0.0
        self._last_read_time: Optional[float] = None

    def read_frame(self) -> Optional[NormalizedFrame]:
        now = time.monotonic()
        if self._last_read_time is not None:
            elapsed = now - self._last_read_time
            remaining = self.min_interval - elapsed
            if remaining > 0:
                time.sleep(remaining)
        self._last_read_time = time.monotonic()
        return self.adapter.read_frame()
