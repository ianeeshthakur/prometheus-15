import pytest
from unittest.mock import MagicMock, patch
import numpy as np
import uuid
import time
from datetime import datetime

from ai.real_providers import RealPlateDetector, StubRealVehicleDetector, StubPaddleOCR, IoUTracker
from ai.schemas import DetectionResult, AIProfile, FrameQuality, PlateStatus
from ai.orchestrator import AIOrchestrator
from ai.config import PROVIDER_MODE

# A dummy class to mock YOLO results
class MockYOLOResult:
    def __init__(self, boxes):
        self.boxes = boxes

class MockYOLOBoxes:
    def __init__(self, cls_id, conf, xyxy):
        # We need these to act like tensors that have .item() or .tolist()
        class DummyTensor:
            def __init__(self, val):
                self.val = val
            def item(self):
                return self.val
            def tolist(self):
                return self.val

        self.cls = [DummyTensor(cls_id)]
        self.conf = [DummyTensor(conf)]
        self.xyxy = [DummyTensor(xyxy)]


def test_plate_detector_missing_model(caplog):
    # Test 3: Missing model path
    det = RealPlateDetector(model_path="missing/path/best.pt", device="cpu")
    assert det.configured is False
    assert "Plate model not found" in caplog.text


@patch('os.path.exists', return_value=True)
def test_plate_detector_import_error(mock_exists, caplog):
    # Test 4: Invalid model path (or missing dependencies)
    with patch.dict('sys.modules', {'ultralytics': None}):
        det = RealPlateDetector(model_path="fake/path", device="cpu")
        assert det.configured is False
        assert "ultralytics not installed" in caplog.text

@patch('os.path.exists', return_value=True)
@patch('ai.real_providers.YOLO', create=True)
def test_plate_detector_valid_init(mock_yolo, mock_exists):
    # Test 1, 2, 18, 19: Real plate model initialization, Valid model path, CPU inference, Model loaded once
    det = RealPlateDetector(model_path="valid/path.pt", device="cpu")
    assert det.configured is True
    assert det.model is not None
    mock_yolo.assert_called_once_with("valid/path.pt")

@patch('os.path.exists', return_value=True)
@patch('ai.real_providers.YOLO', create=True)
def test_plate_detection(mock_yolo, mock_exists):
    # Test 5, 6: Class mapping, Real plate detection
    det = RealPlateDetector(model_path="valid/path.pt", device="cpu")
    
    mock_model = MagicMock()
    det.model = mock_model
    
    # Simulate YOLO finding a plate
    box = MockYOLOBoxes(cls_id=0, conf=0.85, xyxy=[10, 10, 100, 50])
    res = MockYOLOResult(boxes=[box])
    mock_model.predict.return_value = [res]
    
    crop = np.zeros((200, 200, 3), dtype=np.uint8)
    output = det.detect(crop, "VEH-1", "CAM-1", datetime.now(), 1)
    
    assert output is not None
    assert output["bbox"] == [10, 10, 100, 50]
    assert output["plate_detection_confidence"] == 0.85


@patch('os.path.exists', return_value=True)
@patch('ai.real_providers.YOLO', create=True)
def test_no_plate_detection(mock_yolo, mock_exists):
    # Test 7: No plate detection
    det = RealPlateDetector(model_path="valid/path.pt", device="cpu")
    det.model = MagicMock()
    det.model.predict.return_value = []
    
    crop = np.zeros((200, 200, 3), dtype=np.uint8)
    output = det.detect(crop, "VEH-1", "CAM-1", datetime.now(), 1)
    
    assert output is None


def test_vehicle_crop_and_coordinate_translation():
    # Test 9, 10, 11: Vehicle crop, Plate crop, Vehicle-to-plate association
    # We will instantiate the orchestrator and inject mocks to verify exactly what gets passed.
    orchestrator = AIOrchestrator(AIProfile.TRAFFIC)
    
    # Force real mode behavior for the test
    orchestrator.vehicle_detector = MagicMock()
    orchestrator.plate_detector = MagicMock()
    orchestrator.ocr_provider = MagicMock()
    
    # Mock Vehicle
    veh_det = DetectionResult(
        detection_id="VEH-123",
        class_name="VEHICLE",
        confidence=0.9,
        bbox=[100, 100, 500, 500], # Vehicle is 400x400
        camera_uid="CAM-1",
        timestamp=datetime.now(),
        frame_sequence=1,
        model_name="mock",
        model_provider="mock"
    )
    orchestrator.vehicle_detector.detect.return_value = [veh_det]
    
    # Mock Plate detection (bbox relative to the 400x400 crop)
    orchestrator.plate_detector.detect.return_value = {
        "bbox": [50, 50, 150, 100], # plate is inside the vehicle crop
        "plate_detection_confidence": 0.8
    }
    
    # Create a dummy frame (1080p)
    frame = np.zeros((1080, 1920, 3), dtype=np.uint8)
    
    # Call orchestrator
    class MockNormFrame:
        def __init__(self, f):
            self.frame = f
            self.camera_uid = "CAM-1"
            self.timestamp = datetime.now()
            self.frame_sequence = 1
            
    res = orchestrator.analyze_frame(MockNormFrame(frame))
    
    # Assert vehicle was passed
    assert len(res.vehicles) == 1
    assert len(res.plates) == 1
    
    plate = res.plates[0]
    # Global bbox should be 100+50=150, 100+50=150, 100+150=250, 100+100=200
    assert plate.bbox == [150, 150, 250, 200]
    assert plate.vehicle_detection_id == "VEH-123"
    
    # Verify OCR provider received the plate crop correctly
    # Plate crop should be from the vehicle crop, sized 100x50 (width x height)
    call_args = orchestrator.ocr_provider.recognize.call_args
    assert call_args is not None
    plate_crop = call_args[0][0]
    assert plate_crop.shape[:2] == (50, 100) # height, width


def test_provider_failure_isolation():
    # Test 17: Provider failure isolation
    orchestrator = AIOrchestrator(AIProfile.TRAFFIC)
    
    # Vehicle detector works
    orchestrator.vehicle_detector = MagicMock()
    veh_det = DetectionResult(
        detection_id="VEH-123",
        class_name="VEHICLE",
        confidence=0.9,
        bbox=[100, 100, 500, 500],
        camera_uid="CAM-1",
        timestamp=datetime.now(),
        frame_sequence=1,
        model_name="mock",
        model_provider="mock"
    )
    orchestrator.vehicle_detector.detect.return_value = [veh_det]
    
    # Plate detector raises an exception
    orchestrator.plate_detector = MagicMock()
    orchestrator.plate_detector.detect.side_effect = Exception("Model crashed")
    
    frame = np.zeros((1080, 1920, 3), dtype=np.uint8)
    class MockNormFrame:
        def __init__(self, f):
            self.frame = f
            self.camera_uid = "CAM-1"
            self.timestamp = datetime.now()
            self.frame_sequence = 1
            
    res = orchestrator.analyze_frame(MockNormFrame(frame))
    
    # Result should still contain the vehicle, and pipeline shouldn't crash
    assert len(res.vehicles) == 1
    assert len(res.plates) == 0

def test_unreadable_plate():
    # Test 15: Unreadable plate
    orchestrator = AIOrchestrator(AIProfile.TRAFFIC)
    orchestrator._calculate_plate_confidence = AIOrchestrator._calculate_plate_confidence
    
    # plate conf 0.8, ocr conf 0.2 (terrible), quality GOOD
    conf, level, status = orchestrator(AIProfile.TRAFFIC)._calculate_plate_confidence(0.8, 0.2, FrameQuality.GOOD)
    assert status == PlateStatus.UNREADABLE

    # plate conf 0.9, ocr conf 0.6, quality POOR
    conf, level, status = orchestrator(AIProfile.TRAFFIC)._calculate_plate_confidence(0.9, 0.6, FrameQuality.POOR)
    assert status == PlateStatus.UNREADABLE

def test_low_confidence_plate():
    # Test 16: Low confidence plate
    orchestrator = AIOrchestrator(AIProfile.TRAFFIC)
    
    # Not terrible, but below OCR_CONFIDENCE_THRESHOLD (0.7)
    # final_conf = (0.7 + 0.6) / 2 = 0.65 -> below 0.7 but above 0.7 * 0.7=0.49
    conf, level, status = orchestrator(AIProfile.TRAFFIC)._calculate_plate_confidence(0.7, 0.6, FrameQuality.GOOD)
    assert status == PlateStatus.LOW_CONFIDENCE
