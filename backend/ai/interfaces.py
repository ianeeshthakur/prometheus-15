from abc import ABC, abstractmethod
from typing import List, Optional
import numpy as np
from .schemas import DetectionResult, PlateResult, AnomalyResult

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
