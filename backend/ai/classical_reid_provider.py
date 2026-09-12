# A REAL (not fabricated) classical computer-vision re-identification baseline --
# docs/backend.md §12.7, docs/ai_pipelines.md §5. HSV color-histogram similarity via
# OpenCV (cv2.compareHist), which is already a dependency (requirements.txt).
#
# This is meaningfully different from ai/mock_providers.py's MockReIdentificationProvider,
# which derives its "embedding" from crop *dimensions* only and touches zero pixel
# data. This provider actually looks at the image content -- it's a real, standard,
# well-established technique (pre-dates deep learning re-id entirely), not a mock.
#
# It is STILL NOT a substitute for a trained deep-learning re-id model, and STILL NOT
# wired into intelligence/entity_graph.py's real trace logic, for the same reason
# given in ai/interfaces.py's ReIdentificationProvider docstring: nobody has evaluated
# this for real appearance-matching accuracy on this project's actual footage, so
# gating a real investigation match on it would be irresponsible. Color histograms are
# robust to viewpoint/pose changes but weak to lighting changes and capture zero
# shape/texture information -- two different white sedans will often score as
# "similar" as two photos of the same car. Appropriate as a real, honest fallback
# signal or a development/demo aid; not as the sole basis for a policing decision.
# Building and evaluating a real deep embedding model is the actual path to closing
# ai_pipelines.md §5's re-identification differentiator -- this is a floor above the
# mock, not a ceiling.
from typing import List
import numpy as np
import cv2

from .interfaces import ReIdentificationProvider


class ColorHistogramReIdentificationProvider(ReIdentificationProvider):
    _HIST_BINS = (8, 8, 8)  # H, S, V

    def extract_embedding(self, frame_crop: np.ndarray) -> List[float]:
        empty_len = self._HIST_BINS[0] * self._HIST_BINS[1] * self._HIST_BINS[2]
        if frame_crop is None or frame_crop.size == 0:
            return [0.0] * empty_len

        hsv = cv2.cvtColor(frame_crop, cv2.COLOR_BGR2HSV)
        hist = cv2.calcHist([hsv], [0, 1, 2], None, list(self._HIST_BINS), [0, 180, 0, 256, 0, 256])
        cv2.normalize(hist, hist, 0, 1, cv2.NORM_MINMAX)
        return hist.flatten().tolist()

    def similarity(self, embedding_a: List[float], embedding_b: List[float]) -> float:
        if not embedding_a or not embedding_b or len(embedding_a) != len(embedding_b):
            return 0.0
        hist_a = np.array(embedding_a, dtype=np.float32)
        hist_b = np.array(embedding_b, dtype=np.float32)
        # A flat (all-zero) histogram comes from an empty/invalid crop (see
        # extract_embedding above) and carries no real color information at all.
        # cv2's Pearson-correlation formula divides by each histogram's variance, which
        # is zero here, and by convention returns 1.0 ("identical") for two constant
        # inputs -- exactly backwards for this caller, since it would make two garbage
        # crops look like a perfect appearance match. Treat "no signal" as similarity 0,
        # not 1.
        if not np.any(hist_a) or not np.any(hist_b):
            return 0.0
        # HISTCMP_CORREL: 1.0 = identical, can go negative for anti-correlated
        # histograms. Clamped to [0, 1] so this matches the interface's plain
        # "0.0-1.0 similarity" contract instead of callers needing to special-case a
        # negative range.
        correlation = cv2.compareHist(hist_a, hist_b, cv2.HISTCMP_CORREL)
        return max(0.0, float(correlation))
