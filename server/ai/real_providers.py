import os
import uuid
import logging
from typing import List, Optional
import numpy as np

from .interfaces import PlateDetector, VehicleDetector, OCRProvider, VehicleTracker
from .schemas import DetectionResult

logger = logging.getLogger(__name__)

class RealPlateDetector(PlateDetector):
    def __init__(self, model_path: str, device: str = "cpu"):
        self.model_path = model_path
        self.device = device
        self.model = None
        self.configured = False
        self._load_model()

    def _load_model(self):
        if not os.path.exists(self.model_path):
            logger.error(f"Plate model not found at {self.model_path}. Provider NOT_CONFIGURED.")
            return
        
        try:
            from ultralytics import YOLO
            self.model = YOLO(self.model_path)
            self.configured = True
            logger.info("YOLO plate model loaded successfully.")
        except ImportError:
            logger.error("ultralytics not installed. RealPlateDetector NOT_CONFIGURED.")
        except Exception as e:
            logger.error(f"Error loading plate model: {e}")

    def detect(self, frame_crop: np.ndarray, vehicle_id: str, camera_uid: str, timestamp, frame_sequence: int) -> Optional[dict]:
        if not self.configured or self.model is None:
            return None

        # Handle invalid/empty crop safely
        if frame_crop is None or frame_crop.size == 0 or frame_crop.shape[0] == 0 or frame_crop.shape[1] == 0:
            return None

        try:
            # Inference on the crop
            results = self.model.predict(source=frame_crop, device=self.device, verbose=False, conf=0.25)
            if not results or len(results) == 0:
                return None

            best_box = None
            highest_conf = 0.0

            for result in results:
                boxes = result.boxes
                if boxes is None or len(boxes) == 0:
                    continue
                
                # YOLOv8 bounding boxes
                for box in boxes:
                    cls_id = int(box.cls[0].item())
                    # YOLO26n Class 0 = license_plate
                    if cls_id == 0:
                        conf = box.conf[0].item()
                        if conf > highest_conf:
                            highest_conf = conf
                            x1, y1, x2, y2 = box.xyxy[0].tolist()
                            best_box = [int(x1), int(y1), int(x2), int(y2)]

            if best_box:
                return {
                    "bbox": best_box,
                    "plate_detection_confidence": highest_conf
                }
            return None
        except Exception as e:
            logger.error(f"Plate inference failed: {e}")
            return None


class StubRealVehicleDetector(VehicleDetector):
    def __init__(self):
        logger.warning("Real VehicleDetector model NOT_CONFIGURED.")

    def detect(self, frame: np.ndarray, camera_uid: str, timestamp, frame_sequence: int) -> List[DetectionResult]:
        return []


class StubPaddleOCR(OCRProvider):
    def __init__(self):
        try:
            import paddleocr
            logger.warning("PaddleOCR installed, but integration is NOT_CONFIGURED for real inference.")
        except ImportError:
            logger.warning("PaddleOCR not installed. OCRProvider NOT_CONFIGURED.")
    
    def recognize(self, plate_crop: np.ndarray) -> Optional[dict]:
        return None


def calculate_iou(boxA, boxB):
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    interArea = max(0, xB - xA) * max(0, yB - yA)
    if interArea == 0:
        return 0.0

    boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])

    return interArea / float(boxAArea + boxBArea - interArea)


class IoUTracker(VehicleTracker):
    """Smallest appropriate integration as ByteTrack fallback."""
    def __init__(self):
        self.tracks = {}
        self.next_id = 0

    def track(self, detections: List[DetectionResult], frame: np.ndarray) -> List[DetectionResult]:
        new_tracks = {}
        for det in detections:
            best_iou = 0.0
            best_id = None
            for tid, tbox in self.tracks.items():
                iou = calculate_iou(det.bbox, tbox)
                if iou > best_iou:
                    best_iou = iou
                    best_id = tid
            
            if best_iou > 0.3 and best_id is not None:
                det.detection_id = best_id
                new_tracks[best_id] = det.bbox
            else:
                nid = f"TRK-{uuid.uuid4().hex[:8]}"
                det.detection_id = nid
                new_tracks[nid] = det.bbox
                
        self.tracks = new_tracks
        return detections
