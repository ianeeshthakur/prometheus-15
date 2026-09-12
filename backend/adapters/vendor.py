# Vendor SDK implementation boundary -- docs/backend.md §3. Ported verbatim from
# contrib/aneesh/backend/adapters/vendor.py. Explicitly UNSUPPORTED: we do not invent
# imaginary Hikvision/Dahua/Bosch SDK integrations.
import logging
from typing import Optional

from .base import CameraAdapter
from .models import NormalizedFrame

logger = logging.getLogger(__name__)


class VendorSDKAdapter(CameraAdapter):
    def __init__(self, camera_uid: str, config: str):
        self.camera_uid = camera_uid
        self._config = config
        self._status = "UNSUPPORTED"

    def connect(self) -> bool:
        logger.warning(
            f"[{self.camera_uid}] Vendor SDK connect called, but VENDOR_SDK is explicitly "
            "unsupported in this prototype."
        )
        return False

    def read_frame(self) -> Optional[NormalizedFrame]:
        return None

    def health_check(self) -> str:
        return self._status

    def close(self) -> None:
        logger.info(f"[{self.camera_uid}] VendorSDKAdapter closed.")
