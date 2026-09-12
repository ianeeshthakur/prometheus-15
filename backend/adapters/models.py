# Vendor/protocol-neutral frame representation. Ported from contrib/aneesh/backend/adapters/models.py.
from dataclasses import dataclass
from datetime import datetime
import numpy as np


@dataclass
class NormalizedFrame:
    """Downstream AI pipelines (OpenCV, YOLO, OCR) consume this format exclusively."""

    camera_uid: str
    frame: np.ndarray  # Decoded BGR image
    timestamp: datetime
    width: int
    height: int
    source_protocol: str
    frame_sequence: int
