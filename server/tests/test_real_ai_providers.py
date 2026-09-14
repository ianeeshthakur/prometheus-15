# Real (non-mock) plate/OCR + anomaly detection -- ai/real_providers.py. Closes the
# open item asking for real OCR plate-reading and real anomaly detection on live
# camera frames (previously ai/mock_providers.py's fixed dummy outputs regardless of
# frame content). See ai/real_providers.py's module docstring for exact scope/limits.
import cv2
import numpy as np
from datetime import datetime


def _synthetic_plate_frame():
    """A real (not fabricated-metadata) image built with actual pixels: a white
    rectangle with real rendered text on a gray background, run through the real
    Haar cascade + real Tesseract -- not a canned string."""
    scene = np.full((480, 640, 3), 90, dtype="uint8")
    cv2.rectangle(scene, (250, 200), (410, 250), (255, 255, 255), -1)
    cv2.rectangle(scene, (250, 200), (410, 250), (0, 0, 0), 2)
    cv2.putText(scene, "GJ01AB1234", (255, 235), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    return scene


def test_plate_detector_finds_real_plate_region():
    from ai.real_providers import RealPlateDetector

    detector = RealPlateDetector()
    result = detector.detect(_synthetic_plate_frame(), "veh1", "CAM01", datetime.now(), 0)
    assert result is not None
    assert "bbox" in result and len(result["bbox"]) == 4
    assert 0.0 < result["plate_detection_confidence"] <= 1.0


def test_plate_detector_finds_nothing_in_a_blank_frame():
    """A genuinely blank frame has no plate-shaped edges -- the real cascade should
    find nothing, unlike the old mock which always returned a fixed bbox."""
    from ai.real_providers import RealPlateDetector

    detector = RealPlateDetector()
    blank = np.full((480, 640, 3), 128, dtype="uint8")
    result = detector.detect(blank, "veh1", "CAM01", datetime.now(), 0)
    assert result is None


def test_ocr_provider_reads_real_text_from_a_real_crop():
    from ai.real_providers import RealOCRProvider, tesseract_available

    if not tesseract_available():
        import pytest

        pytest.skip("tesseract binary not installed in this environment")

    provider = RealOCRProvider()
    crop = _synthetic_plate_frame()[200:250, 250:410]
    result = provider.recognize(crop)
    assert result is not None
    # Real OCR on rendered text -- not asserting exact match (OCR misreads similar
    # glyphs like 0/O for real reasons), just that it recovered the real alphanumeric
    # content, not a canned "GJ 05 XX 7821" (the old mock's fixed output).
    assert "AB1234" in result["normalized_text"] or "AB1234" in result["raw_text"].replace(" ", "")
    assert 0.0 <= result["ocr_confidence"] <= 1.0


def test_ocr_provider_returns_none_for_empty_crop():
    from ai.real_providers import RealOCRProvider

    provider = RealOCRProvider()
    assert provider.recognize(np.zeros((0, 0, 3), dtype="uint8")) is None


def test_anomaly_detector_silent_during_background_warmup():
    from ai.real_providers import RealAnomalyDetector

    detector = RealAnomalyDetector()
    static_frame = np.full((240, 320, 3), 80, dtype="uint8")
    for i in range(20):
        result = detector.detect(static_frame.copy(), "CAM-WARMUP", datetime.now(), i)
        assert result == []


def test_anomaly_detector_flags_real_motion_spike():
    from ai.real_providers import RealAnomalyDetector

    detector = RealAnomalyDetector()
    base = np.full((240, 320, 3), 80, dtype="uint8")
    for i in range(25):
        detector.detect(base.copy(), "CAM-MOTION", datetime.now(), i)

    frame = base.copy()
    cv2.rectangle(frame, (50, 50), (270, 220), (200, 200, 200), -1)  # large real moving region
    results = detector.detect(frame, "CAM-MOTION", datetime.now(), 25)
    types = [r.anomaly_type for r in results]
    assert "CONGESTION" in types
    assert "SUDDEN_MOTION_SPIKE" in types
    for r in results:
        assert 0.0 < r.confidence <= 1.0
        assert r.model_name == "classical_cv_mog2_bgsub"


def test_anomaly_detector_flags_real_stationary_obstruction():
    from ai.real_providers import RealAnomalyDetector

    detector = RealAnomalyDetector()
    base = np.full((240, 320, 3), 80, dtype="uint8")
    for i in range(25):
        detector.detect(base.copy(), "CAM-STATIC", datetime.now(), i)

    triggered = False
    for i in range(25, 60):
        frame = base.copy()
        cv2.rectangle(frame, (100, 100), (150, 150), (200, 200, 200), -1)  # same spot every frame
        results = detector.detect(frame, "CAM-STATIC", datetime.now(), i)
        if any(r.anomaly_type == "STATIONARY_OBSTRUCTION" for r in results):
            triggered = True
            break
    assert triggered, "a real object held in the same place for 30+ frames should eventually be flagged"


def test_anomaly_detector_state_is_isolated_per_camera():
    """Two cameras must not share warmup/history state -- a busy CAM-A shouldn't make
    CAM-B's very first frame look anomalous."""
    from ai.real_providers import RealAnomalyDetector

    detector = RealAnomalyDetector()
    base = np.full((240, 320, 3), 80, dtype="uint8")
    busy = base.copy()
    cv2.rectangle(busy, (0, 0), (320, 240), (200, 200, 200), -1)
    for i in range(30):
        detector.detect(busy, "CAM-A", datetime.now(), i)

    result = detector.detect(base.copy(), "CAM-B", datetime.now(), 0)
    assert result == []
