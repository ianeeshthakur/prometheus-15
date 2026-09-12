from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

class FrameQuality(str, Enum):
    GOOD = "GOOD"
    FAIR = "FAIR"
    POOR = "POOR"

class AIProfile(str, Enum):
    TRAFFIC = "TRAFFIC"
    SECURITY = "SECURITY"
    RTO = "RTO"

class DetectionResult(BaseModel):
    detection_id: str
    class_name: str
    confidence: float
    bbox: List[int]  # [x_min, y_min, x_max, y_max]
    camera_uid: str
    timestamp: datetime
    frame_sequence: int
    model_name: str
    model_provider: str

class PlateStatus(str, Enum):
    READABLE = "READABLE"
    LOW_CONFIDENCE = "LOW_CONFIDENCE"
    UNREADABLE = "UNREADABLE"

class PlateResult(BaseModel):
    plate_id: str
    vehicle_detection_id: str
    bbox: List[int]
    raw_text: str
    normalized_text: str
    plate_detection_confidence: float
    ocr_confidence: float
    quality_score: float
    final_confidence: float
    confidence_level: str
    status: PlateStatus

class AnomalyResult(BaseModel):
    anomaly_id: str
    anomaly_type: str
    confidence: float
    camera_uid: str
    timestamp: datetime
    frame_sequence: int
    model_name: str
    status: str

class AIAnalysisResult(BaseModel):
    camera_uid: str
    timestamp: datetime
    frame_sequence: int
    frame_quality: FrameQuality
    detections: List[DetectionResult] = []
    vehicles: List[DetectionResult] = []
    persons: List[DetectionResult] = []
    plates: List[PlateResult] = []
    anomalies: List[AnomalyResult] = []
    processing_time_ms: int
    model_provider: str
    model_versions: dict = {}
    overall_status: str
