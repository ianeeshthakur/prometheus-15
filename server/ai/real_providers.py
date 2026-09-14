# Real (non-mock) plate/OCR + classical-CV anomaly providers -- swaps into the same
# ai/interfaces.py boundary ai/mock_providers.py implements, per ai/README.md's
# documented swap-in procedure. Built to close the docs/backend.md open item asking
# for real OCR plate-reading and real anomaly detection on live camera frames.
#
# Scope, stated plainly (no fabricated capability):
#   - PlateDetector: OpenCV's bundled Haar cascade (haarcascade_russian_plate_number.xml,
#     ships with opencv-python-headless under cv2.data.haarcascades -- no model
#     download needed). A real classical detector, not a deep model; tuned for
#     rectangular plate-like regions in general, not Indian plates specifically, so
#     recall on low-resolution/angled real camera frames will be imperfect. Runs on
#     the full frame (ai/orchestrator.py's vehicle detection is still
#     MockVehicleDetector, so there is no real vehicle crop to restrict to yet).
#   - OCRProvider: real Tesseract OCR via pytesseract, restricted to an
#     alphanumeric-plate character whitelist, confidence from Tesseract's own
#     per-word confidence output (image_to_data) -- not invented.
#   - AnomalyDetector: real classical background-subtraction (MOG2) motion analysis,
#     stateful per camera_uid. Detects three real, computable conditions:
#     CONGESTION (sustained high foreground ratio), SUDDEN_MOTION_SPIKE (foreground
#     ratio jumps well above its own recent rolling average), and
#     STATIONARY_OBSTRUCTION (a foreground blob's centroid stays put across many
#     consecutive analyzed frames -- e.g. a stalled vehicle or loitering). This is
#     motion/statistics-based, not semantic (it cannot name "wrong-way" or
#     "weapon" the way a trained model could) -- documented here rather than implied.
#
# PYTESSERACT_CMD resolution: pytesseract shells out to the real tesseract.exe binary
# (not pip-installable -- installed separately, e.g. via `winget install
# UB-Mannheim.TesseractOCR`). We check common Windows install paths and fall back to
# PATH; if none resolve, OCRProvider.recognize() returns None rather than raising, so
# a missing binary degrades to "no plate text" instead of crashing the pipeline.
import logging
import os
import shutil
from collections import deque
from typing import Dict, List, Optional

import cv2
import numpy as np
import pytesseract

from .interfaces import AnomalyDetector, OCRProvider, PlateDetector
from .schemas import AnomalyResult

logger = logging.getLogger(__name__)

_TESSERACT_CANDIDATES = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
]
for _candidate in _TESSERACT_CANDIDATES:
    if os.path.isfile(_candidate):
        pytesseract.pytesseract.tesseract_cmd = _candidate
        break
else:
    _on_path = shutil.which("tesseract")
    if _on_path:
        pytesseract.pytesseract.tesseract_cmd = _on_path


def tesseract_available() -> bool:
    return bool(shutil.which(pytesseract.pytesseract.tesseract_cmd) or os.path.isfile(pytesseract.pytesseract.tesseract_cmd))


_PLATE_CASCADE_PATH = os.path.join(cv2.data.haarcascades, "haarcascade_russian_plate_number.xml")


class RealPlateDetector(PlateDetector):
    def __init__(self):
        self._cascade = cv2.CascadeClassifier(_PLATE_CASCADE_PATH)
        if self._cascade.empty():
            raise RuntimeError(f"Failed to load plate cascade from {_PLATE_CASCADE_PATH}")

    def detect(self, frame_crop: np.ndarray, vehicle_id: str, camera_uid: str, timestamp, frame_sequence: int) -> Optional[dict]:
        gray = cv2.cvtColor(frame_crop, cv2.COLOR_BGR2GRAY)
        # detectMultiScale3 also returns rejectLevels/levelWeights -- levelWeights is
        # the cascade's real internal confidence score (how strongly the final stage
        # matched), used below instead of inventing a confidence number.
        rects, reject_levels, level_weights = self._cascade.detectMultiScale3(
            gray, scaleFactor=1.05, minNeighbors=4, minSize=(60, 20), outputRejectLevels=True
        )
        if len(rects) == 0:
            return None

        best_idx = int(np.argmax(level_weights))
        x, y, w, h = [int(v) for v in rects[best_idx]]
        # level_weights is an unbounded cascade score, not a probability -- squash it
        # into (0, 1) so it's comparable to PLATE_CONFIDENCE_THRESHOLD the same way
        # the mock provider's confidence was, without pretending it's calibrated.
        raw_weight = float(level_weights[best_idx])
        confidence = min(0.99, raw_weight / (raw_weight + 5.0))

        return {
            "bbox": [x, y, x + w, y + h],
            "plate_detection_confidence": confidence,
        }


class RealOCRProvider(OCRProvider):
    # Indian plates (and most others) use uppercase letters + digits + spaces only.
    _WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

    def __init__(self):
        self._available = tesseract_available()
        if not self._available:
            logger.warning(
                "Tesseract binary not found (pytesseract.pytesseract.tesseract_cmd=%r) "
                "-- RealOCRProvider will return None for every plate crop.",
                pytesseract.pytesseract.tesseract_cmd,
            )

    def recognize(self, plate_crop: np.ndarray) -> Optional[dict]:
        if not self._available or plate_crop is None or plate_crop.size == 0:
            return None

        gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY)
        # Upscale small crops -- Tesseract's accuracy drops sharply below ~30px text
        # height, and RTSP plate crops are often that small.
        h, w = gray.shape[:2]
        if h < 60:
            scale = 60 / max(h, 1)
            gray = cv2.resize(gray, (int(w * scale), 60), interpolation=cv2.INTER_CUBIC)
        gray = cv2.bilateralFilter(gray, 5, 40, 40)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        config = f"--psm 7 -c tessedit_char_whitelist={self._WHITELIST}"
        try:
            data = pytesseract.image_to_data(thresh, config=config, output_type=pytesseract.Output.DICT)
        except pytesseract.TesseractError as e:
            logger.warning("Tesseract OCR failed: %s", e)
            return None

        words, confidences = [], []
        for text, conf in zip(data["text"], data["conf"]):
            text = text.strip()
            conf = float(conf)
            if text and conf >= 0:  # Tesseract uses -1 for "no confidence" (non-text) rows
                words.append(text)
                confidences.append(conf)

        if not words:
            return None

        raw_text = " ".join(words)
        normalized_text = "".join(words).upper()
        # Tesseract reports confidence 0-100; normalize to the 0.0-1.0 scale the rest
        # of the pipeline (OCR_CONFIDENCE_THRESHOLD etc.) already uses.
        ocr_confidence = (sum(confidences) / len(confidences)) / 100.0

        return {
            "raw_text": raw_text,
            "normalized_text": normalized_text,
            "ocr_confidence": ocr_confidence,
        }


class _CameraMotionState:
    """Per-camera_uid state for RealAnomalyDetector -- background subtractor plus a
    short rolling history of foreground ratio and the largest blob's centroid, so
    anomalies can be judged relative to that camera's own recent baseline rather
    than a single hardcoded global threshold."""

    def __init__(self):
        self.bg_subtractor = cv2.createBackgroundSubtractorMOG2(history=200, varThreshold=32, detectShadows=True)
        self.ratio_history: deque = deque(maxlen=30)
        self.stationary_centroid: Optional[tuple] = None
        self.stationary_streak: int = 0
        self.frames_seen: int = 0


class RealAnomalyDetector(AnomalyDetector):
    # Tunables -- classical-CV heuristics, documented rather than hidden magic numbers.
    CONGESTION_RATIO = 0.35          # >35% of frame flagged foreground
    SPIKE_DELTA = 0.20               # current ratio this much above its own rolling mean
    MIN_HISTORY_FOR_SPIKE = 10       # need a real baseline before calling something a "spike"
    STATIONARY_CENTROID_TOLERANCE = 15  # px the blob centroid may drift and still count as "same spot"
    STATIONARY_MIN_STREAK = 20       # consecutive analyzed frames before calling it stalled/loitering
    MIN_CONTOUR_AREA_RATIO = 0.02    # ignore tiny noise contours

    def __init__(self):
        self._states: Dict[str, _CameraMotionState] = {}

    def _state_for(self, camera_uid: str) -> _CameraMotionState:
        if camera_uid not in self._states:
            self._states[camera_uid] = _CameraMotionState()
        return self._states[camera_uid]

    def detect(self, frame: np.ndarray, camera_uid: str, timestamp, frame_sequence: int) -> List[AnomalyResult]:
        state = self._state_for(camera_uid)
        state.frames_seen += 1

        # Explicit low learning rate -- MOG2's default (1/history, i.e. ~1/200 here but
        # applied per-pixel-frame) still absorbs a genuinely static intruding object
        # (a stalled vehicle, a dropped bag) into the modeled background within only a
        # handful of frames in practice, which made STATIONARY_OBSTRUCTION
        # unreachable: found by actually running a synthetic held-still-object test
        # and watching the foreground streak reset to 0 after ~5 frames. A slower
        # rate keeps a real static object flagged as foreground long enough for the
        # streak counter below to matter, at the cost of adapting to real lighting
        # changes more slowly.
        fg_mask = state.bg_subtractor.apply(frame, learningRate=0.003)
        # MOG2 with detectShadows marks shadow pixels as 127 -- keep only the real
        # foreground (255), otherwise shadows inflate the ratio on sunny scenes.
        fg_mask = (fg_mask == 255).astype("uint8") * 255

        total_px = fg_mask.shape[0] * fg_mask.shape[1]
        fg_ratio = float(np.count_nonzero(fg_mask)) / total_px if total_px else 0.0

        anomalies: List[AnomalyResult] = []

        # Let the background subtractor warm up (its first ~20 frames are unreliable
        # by design -- it hasn't learned the static scene yet) before judging anything.
        if state.frames_seen <= 20:
            state.ratio_history.append(fg_ratio)
            return anomalies

        if fg_ratio >= self.CONGESTION_RATIO:
            anomalies.append(self._make_anomaly("CONGESTION", min(0.95, fg_ratio), camera_uid, timestamp, frame_sequence))

        if len(state.ratio_history) >= self.MIN_HISTORY_FOR_SPIKE:
            baseline = sum(state.ratio_history) / len(state.ratio_history)
            if fg_ratio - baseline >= self.SPIKE_DELTA:
                spike_conf = min(0.95, (fg_ratio - baseline) / max(self.SPIKE_DELTA, 0.01) * 0.5)
                anomalies.append(self._make_anomaly("SUDDEN_MOTION_SPIKE", spike_conf, camera_uid, timestamp, frame_sequence))

        # Stationary-object check: find the largest foreground contour and see if its
        # centroid has stayed put across consecutive frames.
        contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        largest = max(contours, key=cv2.contourArea) if contours else None
        if largest is not None and cv2.contourArea(largest) / total_px >= self.MIN_CONTOUR_AREA_RATIO:
            M = cv2.moments(largest)
            if M["m00"] != 0:
                cx, cy = M["m10"] / M["m00"], M["m01"] / M["m00"]
                if state.stationary_centroid is not None:
                    dx = cx - state.stationary_centroid[0]
                    dy = cy - state.stationary_centroid[1]
                    if (dx * dx + dy * dy) ** 0.5 <= self.STATIONARY_CENTROID_TOLERANCE:
                        state.stationary_streak += 1
                    else:
                        state.stationary_streak = 0
                state.stationary_centroid = (cx, cy)
                if state.stationary_streak >= self.STATIONARY_MIN_STREAK:
                    conf = min(0.95, 0.5 + state.stationary_streak / (self.STATIONARY_MIN_STREAK * 4))
                    anomalies.append(self._make_anomaly("STATIONARY_OBSTRUCTION", conf, camera_uid, timestamp, frame_sequence))
        else:
            state.stationary_centroid = None
            state.stationary_streak = 0

        state.ratio_history.append(fg_ratio)
        return anomalies

    @staticmethod
    def _make_anomaly(anomaly_type: str, confidence: float, camera_uid: str, timestamp, frame_sequence: int) -> AnomalyResult:
        import uuid

        return AnomalyResult(
            anomaly_id=f"ANM-{uuid.uuid4().hex[:8]}",
            anomaly_type=anomaly_type,
            confidence=round(confidence, 3),
            camera_uid=camera_uid,
            timestamp=timestamp,
            frame_sequence=frame_sequence,
            model_name="classical_cv_mog2_bgsub",
            status="DETECTED",
        )
