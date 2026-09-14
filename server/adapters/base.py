# Abstract adapter interface -- docs/backend.md §3. Ported from contrib/aneesh/backend/adapters/base.py.
from abc import ABC, abstractmethod
from typing import Optional
from .models import NormalizedFrame


class CameraAdapter(ABC):
    """Ensures heterogeneous CCTV sources produce standard NormalizedFrames."""

    @abstractmethod
    def connect(self) -> bool:
        """Establish connection to the camera/stream. Returns True if successful."""
        pass

    @abstractmethod
    def read_frame(self) -> Optional[NormalizedFrame]:
        """Fetch and decode the next frame."""
        pass

    @abstractmethod
    def health_check(self) -> str:
        """Returns adapter status: CONNECTING, ACTIVE, DEGRADED, OFFLINE, UNSUPPORTED, NOT_CONFIGURED."""
        pass

    @abstractmethod
    def close(self) -> None:
        """Safely release underlying network and decoding resources."""
        pass
