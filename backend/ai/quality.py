# Frame quality gating -- docs/ai_pipelines.md §1. Ported verbatim from
# contrib/aneesh/backend/ai/quality.py.
import cv2
import numpy as np
from .schemas import FrameQuality


class FrameQualityAnalyzer:
    """Lightweight frame quality analyzer."""

    @staticmethod
    def analyze(frame: np.ndarray) -> FrameQuality:
        height, width = frame.shape[:2]
        if width < 320 or height < 240:
            return FrameQuality.POOR

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
        brightness = np.mean(gray)

        if blur_score < 50.0 or brightness < 30.0 or brightness > 220.0:
            return FrameQuality.POOR
        elif blur_score < 100.0 or brightness < 50.0 or brightness > 200.0:
            return FrameQuality.FAIR

        return FrameQuality.GOOD
