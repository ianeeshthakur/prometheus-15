from dataclasses import dataclass
from datetime import datetime
import numpy as np

@dataclass
class NormalizedFrame:
    """
    Vendor/protocol-neutral representation of a video frame.
    Downstream AI pipelines (OpenCV, YOLO, OCR) consume this format exclusively.
    """
    camera_uid: str
    frame: np.ndarray  # Decoded BGR image
    timestamp: datetime
    width: int
    height: int
    source_protocol: str
    frame_sequence: int
