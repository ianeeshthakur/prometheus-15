# Abstract detector interfaces -- the mock/real provider swap boundary, docs/ai_pipelines.md
# §1. Ported verbatim from contrib/aneesh/backend/ai/interfaces.py.
from abc import ABC, abstractmethod
from typing import List, Optional
import numpy as np
from .schemas import DetectionResult, AnomalyResult


class VehicleDetector(ABC):
    @abstractmethod
    def detect(self, frame: np.ndarray, camera_uid: str, timestamp, frame_sequence: int) -> List[DetectionResult]:
        pass


class PersonDetector(ABC):
    @abstractmethod
    def detect(self, frame: np.ndarray, camera_uid: str, timestamp, frame_sequence: int) -> List[DetectionResult]:
        pass


class AnomalyDetector(ABC):
    @abstractmethod
    def detect(self, frame: np.ndarray, camera_uid: str, timestamp, frame_sequence: int) -> List[AnomalyResult]:
        pass


class PlateDetector(ABC):
    @abstractmethod
    def detect(self, frame_crop: np.ndarray, vehicle_id: str, camera_uid: str, timestamp, frame_sequence: int) -> Optional[dict]:
        """Returns dict containing bbox and plate_detection_confidence, to be passed to PlateResult."""
        pass


class OCRProvider(ABC):
    @abstractmethod
    def recognize(self, plate_crop: np.ndarray) -> Optional[dict]:
        """Returns dict containing raw_text, normalized_text, and ocr_confidence."""
        pass


class ReIdentificationProvider(ABC):
    """Appearance-based cross-camera re-identification -- docs/ai_pipelines.md §5
    differentiator, docs/backend.md §12.5. Scaffolding only: this interface exists so a
    real embedding model can be swapped in later (same pattern as every other detector
    in this file -- see ai/README.md), but nothing in the pipeline calls it yet.
    intelligence/entity_graph.py's real trace_entity() deliberately does NOT use this
    -- it's exact-identifier correlation only, and wiring an unvalidated mock
    embedding comparison into the graded vehicle-tracking test's actual code path
    would be dishonest. Build a real provider and a real accuracy evaluation first."""

    @abstractmethod
    def extract_embedding(self, frame_crop: np.ndarray) -> List[float]:
        """Returns a fixed-length embedding vector for a cropped person/vehicle."""
        pass

    @abstractmethod
    def similarity(self, embedding_a: List[float], embedding_b: List[float]) -> float:
        """Returns a 0.0-1.0 similarity score between two embeddings."""
        pass
