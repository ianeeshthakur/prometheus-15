# Mock detector implementations, swappable for real models per ai/README.md -- docs/ai_pipelines.md
# §1/§2. Ported verbatim from contrib/aneesh/backend/ai/mock_providers.py.
import uuid
from typing import List, Optional
import numpy as np

from .interfaces import VehicleDetector, PersonDetector, AnomalyDetector, PlateDetector, OCRProvider, ReIdentificationProvider
from .schemas import DetectionResult, AnomalyResult


class MockVehicleDetector(VehicleDetector):
    def detect(self, frame: np.ndarray, camera_uid: str, timestamp, frame_sequence: int) -> List[DetectionResult]:
        height, width = frame.shape[:2]
        return [
            DetectionResult(
                detection_id=f"VEH-{uuid.uuid4().hex[:8]}",
                class_name="VEHICLE",
                confidence=0.95,
                bbox=[width // 4, height // 4, width * 3 // 4, height * 3 // 4],
                camera_uid=camera_uid,
                timestamp=timestamp,
                frame_sequence=frame_sequence,
                model_name="mock_yolo_v8_vehicle",
                model_provider="MOCK",
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
                bbox=[width // 2, height // 2, width // 2 + 50, height // 2 + 100],
                camera_uid=camera_uid,
                timestamp=timestamp,
                frame_sequence=frame_sequence,
                model_name="mock_yolo_v8_person",
                model_provider="MOCK",
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
                status="DETECTED",
            )
        ]


class MockPlateDetector(PlateDetector):
    def detect(self, frame_crop: np.ndarray, vehicle_id: str, camera_uid: str, timestamp, frame_sequence: int) -> Optional[dict]:
        height, width = frame_crop.shape[:2]
        return {
            "bbox": [width // 4, height // 2, width * 3 // 4, height * 3 // 4],
            "plate_detection_confidence": 0.90,
        }


class MockOCRProvider(OCRProvider):
    def recognize(self, plate_crop: np.ndarray) -> Optional[dict]:
        return {
            "raw_text": "GJ 05 XX 7821",
            "normalized_text": "GJ05XX7821",
            "ocr_confidence": 0.85,
        }


class MockReIdentificationProvider(ReIdentificationProvider):
    """NOT a real embedding model -- docs/backend.md §12.5. Exists only so pipeline
    code can be exercised end-to-end (extract an embedding, compare two embeddings)
    before a real model exists; the embedding is derived from crop dimensions alone,
    which carries zero real appearance information. similarity() is NOT calibrated
    against anything and must never be used to gate a real match -- nothing in the
    pipeline calls this provider yet (see ai/interfaces.py's ReIdentificationProvider
    docstring for why)."""

    _EMBEDDING_DIM = 8

    def extract_embedding(self, frame_crop: np.ndarray) -> List[float]:
        height, width = frame_crop.shape[:2]
        aspect = width / height if height else 0.0
        # Deterministic, dimension-derived filler -- explicitly not a real appearance
        # embedding. Fixed length so downstream code can exercise real vector-math
        # shapes without a real model.
        return [float(height), float(width), aspect] + [0.0] * (self._EMBEDDING_DIM - 3)

    def similarity(self, embedding_a: List[float], embedding_b: List[float]) -> float:
        if not embedding_a or not embedding_b or len(embedding_a) != len(embedding_b):
            return 0.0
        dot = sum(a * b for a, b in zip(embedding_a, embedding_b))
        norm_a = sum(a * a for a in embedding_a) ** 0.5
        norm_b = sum(b * b for b in embedding_b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)  # cosine similarity -- real math, meaningless inputs
