# ONVIF implementation boundary -- docs/backend.md §3. Ported verbatim from
# contrib/aneesh/backend/adapters/onvif.py. Explicitly UNSUPPORTED: no authorized real
# ONVIF endpoint has been available to test against, so this returns an honest
# unsupported state rather than faking live video (docs/prd.md §0.1 mode-honesty rule).
import logging
from typing import Optional

from .base import CameraAdapter
from .models import NormalizedFrame

logger = logging.getLogger(__name__)


class ONVIFAdapter(CameraAdapter):
    def __init__(self, camera_uid: str, config: str):
        self.camera_uid = camera_uid
        self._config = config
        self._status = "UNSUPPORTED"

    def connect(self) -> bool:
        logger.warning(
            f"[{self.camera_uid}] ONVIF connect called, but ONVIF is explicitly unsupported "
            "in this prototype without authorized testing hardware."
        )
        return False

    def read_frame(self) -> Optional[NormalizedFrame]:
        return None

    def health_check(self) -> str:
        return self._status

    def close(self) -> None:
        logger.info(f"[{self.camera_uid}] ONVIFAdapter closed.")
