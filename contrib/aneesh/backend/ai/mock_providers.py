import uuid
from typing import List, Optional
import numpy as np

from .interfaces import VehicleDetector, PersonDetector, AnomalyDetector, PlateDetector, OCRProvider
from .schemas import DetectionResult, AnomalyResult

class MockVehicleDetector(VehicleDetector):
    def detect(self, frame: np.ndarray, camera_uid: str, timestamp, frame_sequence: int) -> List[DetectionResult]:
        # Always return a mock vehicle
        height, width = frame.shape[:2]
        return [
            DetectionResult(
                detection_id=f"VEH-{uuid.uuid4().hex[:8]}",
                class_name="VEHICLE",
                confidence=0.95,
                bbox=[width//4, height//4, width*3//4, height*3//4],
                camera_uid=camera_uid,
                timestamp=timestamp,
                frame_sequence=frame_sequence,
                model_name="mock_yolo_v8_vehicle",
                model_provider="MOCK"
            )
        ]

class MockPersonDetector(PersonDetector):
    def detect(self, frame: np.ndarray, camera_uid: str, timestamp, frame_sequence: int) -> List[DetectionResult]:
        height, width = frame.shape[:2]
        return [
            DetectionResult(
                detection_id=f"PER-{uuid.uuid4().hex[:8]}",
                class_name="PERSON",
                confidence=0.88,
                bbox=[width//2, height//2, width//2 + 50, height//2 + 100],
                camera_uid=camera_uid,
                timestamp=timestamp,
                frame_sequence=frame_sequence,
                model_name="mock_yolo_v8_person",
                model_provider="MOCK"
            )
        ]

class MockAnomalyDetector(AnomalyDetector):
    def detect(self, frame: np.ndarray, camera_uid: str, timestamp, frame_sequence: int) -> List[AnomalyResult]:
        return [
            AnomalyResult(
                anomaly_id=f"ANM-{uuid.uuid4().hex[:8]}",
                anomaly_type="WRONG_WAY",
                confidence=0.75,
                camera_uid=camera_uid,
                timestamp=timestamp,
                frame_sequence=frame_sequence,
                model_name="mock_anomaly_resnet",
                status="DETECTED"
            )
        ]

class MockPlateDetector(PlateDetector):
    def detect(self, frame_crop: np.ndarray, vehicle_id: str, camera_uid: str, timestamp, frame_sequence: int) -> Optional[dict]:
        height, width = frame_crop.shape[:2]
        return {
            "bbox": [width//4, height//2, width*3//4, height*3//4],
            "plate_detection_confidence": 0.90
        }

class MockOCRProvider(OCRProvider):
    def recognize(self, plate_crop: np.ndarray) -> Optional[dict]:
        return {
            "raw_text": "GJ 05 XX 7821",
            "normalized_text": "GJ05XX7821",
            "ocr_confidence": 0.85
        }
