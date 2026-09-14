# AIOrchestrator -- profile-driven detection pipeline, docs/ai_pipelines.md §1/§3.
# Ported verbatim from contrib/aneesh/backend/ai/orchestrator.py.
import time
import uuid
import logging

from adapters.models import NormalizedFrame
from .schemas import AIProfile, FrameQuality, PlateStatus, PlateResult, AIAnalysisResult
from .config import AI_PROFILES_CONFIG, OCR_CONFIDENCE_THRESHOLD, PLATE_CONFIDENCE_THRESHOLD, PROVIDER_MODE, DEVICE, PLATE_MODEL_PATH
from .quality import FrameQualityAnalyzer
from .mock_providers import (
    MockVehicleDetector,
    MockPersonDetector,
    MockAnomalyDetector,
    MockPlateDetector,
    MockOCRProvider,
)
from .real_providers import (
    RealPlateDetector,
    StubRealVehicleDetector,
    StubPaddleOCR,
    IoUTracker
)

logger = logging.getLogger(__name__)


class AIOrchestrator:
    def __init__(self, profile: AIProfile):
        self.profile = profile
        self.config = AI_PROFILES_CONFIG[profile]

        # Mock providers today; see ai/README.md for the real-model swap-in procedure
        # (docs/ai_pipelines.md §1 mock-provider interface boundary).
        if PROVIDER_MODE == "REAL":
            self.vehicle_detector = StubRealVehicleDetector()
            self.person_detector = MockPersonDetector()
            self.anomaly_detector = MockAnomalyDetector()
            self.plate_detector = RealPlateDetector(PLATE_MODEL_PATH, DEVICE)
            self.ocr_provider = StubPaddleOCR()
            self.tracker = IoUTracker()
        else:
            self.vehicle_detector = MockVehicleDetector()
            self.person_detector = MockPersonDetector()
            self.anomaly_detector = MockAnomalyDetector()
            self.plate_detector = MockPlateDetector()
            self.ocr_provider = MockOCRProvider()
            self.tracker = None

    def _calculate_plate_confidence(self, pd_conf: float, ocr_conf: float, quality: FrameQuality) -> tuple[float, str, PlateStatus]:
        q_multiplier = 1.0 if quality == FrameQuality.GOOD else (0.8 if quality == FrameQuality.FAIR else 0.4)
        final_conf = ((pd_conf + ocr_conf) / 2) * q_multiplier

        level = "HIGH" if final_conf > 0.8 else ("MEDIUM" if final_conf > 0.5 else "LOW")

        # Never hallucinate a plate -- docs/ai_pipelines.md §2. Below threshold, the
        # status is UNREADABLE/LOW_CONFIDENCE, never a guessed string.
        if quality == FrameQuality.POOR or final_conf < OCR_CONFIDENCE_THRESHOLD * 0.7:
            status = PlateStatus.UNREADABLE
        elif final_conf < OCR_CONFIDENCE_THRESHOLD:
            status = PlateStatus.LOW_CONFIDENCE
        else:
            status = PlateStatus.READABLE

        return final_conf, level, status

    def analyze_frame(self, norm_frame: NormalizedFrame) -> AIAnalysisResult:
        start_time = time.time()

        frame = norm_frame.frame
        quality = FrameQualityAnalyzer.analyze(frame)

        vehicles, persons, anomalies, plates = [], [], [], []

        if self.config.get("person_detection"):
            persons = self.person_detector.detect(frame, norm_frame.camera_uid, norm_frame.timestamp, norm_frame.frame_sequence)

        if self.config.get("anomaly_detection"):
            anomalies = self.anomaly_detector.detect(frame, norm_frame.camera_uid, norm_frame.timestamp, norm_frame.frame_sequence)

        # Vehicle -> plate (two-stage, within a vehicle crop per docs/ai_pipelines.md §2) -> OCR
        if self.config.get("vehicle_detection"):
            vehicles = self.vehicle_detector.detect(frame, norm_frame.camera_uid, norm_frame.timestamp, norm_frame.frame_sequence)

            if self.tracker:
                vehicles = self.tracker.track(vehicles, frame)

            if self.config.get("plate_detection"):
                height, width = frame.shape[:2]
                
                if not vehicles:
                    # FALLBACK: No vehicles detected, run plate detector on the full frame
                    plate_res = self.plate_detector.detect(frame, "FULL_FRAME", norm_frame.camera_uid, norm_frame.timestamp, norm_frame.frame_sequence)
                    if plate_res and plate_res["plate_detection_confidence"] >= PLATE_CONFIDENCE_THRESHOLD:
                        raw_txt, norm_txt, ocr_conf = "", "", 0.0
                        global_bbox = plate_res["bbox"]
                        
                        if self.config.get("ocr"):
                            p_cx1 = max(0, int(global_bbox[0]))
                            p_cy1 = max(0, int(global_bbox[1]))
                            p_cx2 = min(width, int(global_bbox[2]))
                            p_cy2 = min(height, int(global_bbox[3]))
                            
                            if p_cx2 > p_cx1 and p_cy2 > p_cy1:
                                plate_crop = frame[p_cy1:p_cy2, p_cx1:p_cx2]
                                ocr_res = self.ocr_provider.recognize(plate_crop)
                                if ocr_res:
                                    raw_txt = ocr_res["raw_text"]
                                    norm_txt = ocr_res["normalized_text"]
                                    ocr_conf = ocr_res["ocr_confidence"]

                        final_conf, level, status = self._calculate_plate_confidence(
                            plate_res["plate_detection_confidence"], ocr_conf, quality
                        )

                        plates.append(
                            PlateResult(
                                plate_id=f"PLT-{uuid.uuid4().hex[:8]}",
                                vehicle_detection_id="FULL_FRAME",
                                bbox=global_bbox,
                                raw_text=raw_txt,
                                normalized_text=norm_txt,
                                plate_detection_confidence=plate_res["plate_detection_confidence"],
                                ocr_confidence=ocr_conf,
                                quality_score=1.0 if quality == FrameQuality.GOOD else 0.5,
                                final_confidence=final_conf,
                                confidence_level=level,
                                status=status,
                            )
                        )
                else:
                    for v in vehicles:
                        # Clip bbox safely
                        vx1 = max(0, min(width - 1, int(v.bbox[0])))
                        vy1 = max(0, min(height - 1, int(v.bbox[1])))
                        vx2 = max(0, min(width, int(v.bbox[2])))
                        vy2 = max(0, min(height, int(v.bbox[3])))
                        
                        if vx2 <= vx1 or vy2 <= vy1:
                            continue
                            
                        vehicle_crop = frame[vy1:vy2, vx1:vx2]

                        plate_res = self.plate_detector.detect(vehicle_crop, v.detection_id, norm_frame.camera_uid, norm_frame.timestamp, norm_frame.frame_sequence)
                        if plate_res and plate_res["plate_detection_confidence"] >= PLATE_CONFIDENCE_THRESHOLD:
                            raw_txt, norm_txt, ocr_conf = "", "", 0.0
                            
                            # Convert crop coords back to frame coords
                            px1 = vx1 + int(plate_res["bbox"][0])
                            py1 = vy1 + int(plate_res["bbox"][1])
                            px2 = vx1 + int(plate_res["bbox"][2])
                            py2 = vy1 + int(plate_res["bbox"][3])
                            global_bbox = [px1, py1, px2, py2]

                            if self.config.get("ocr"):
                                p_cx1 = max(0, int(plate_res["bbox"][0]))
                                p_cy1 = max(0, int(plate_res["bbox"][1]))
                                p_cx2 = min(vx2 - vx1, int(plate_res["bbox"][2]))
                                p_cy2 = min(vy2 - vy1, int(plate_res["bbox"][3]))
                                
                                if p_cx2 > p_cx1 and p_cy2 > p_cy1:
                                    plate_crop = vehicle_crop[p_cy1:p_cy2, p_cx1:p_cx2]
                                    ocr_res = self.ocr_provider.recognize(plate_crop)
                                    if ocr_res:
                                        raw_txt = ocr_res["raw_text"]
                                        norm_txt = ocr_res["normalized_text"]
                                        ocr_conf = ocr_res["ocr_confidence"]

                            final_conf, level, status = self._calculate_plate_confidence(
                                plate_res["plate_detection_confidence"], ocr_conf, quality
                            )

                            plates.append(
                                PlateResult(
                                    plate_id=f"PLT-{uuid.uuid4().hex[:8]}",
                                    vehicle_detection_id=v.detection_id,
                                    bbox=global_bbox,
                                    raw_text=raw_txt,
                                    normalized_text=norm_txt,
                                    plate_detection_confidence=plate_res["plate_detection_confidence"],
                                    ocr_confidence=ocr_conf,
                                    quality_score=1.0 if quality == FrameQuality.GOOD else 0.5,
                                    final_confidence=final_conf,
                                    confidence_level=level,
                                    status=status,
                                )
                            )

        processing_time = int((time.time() - start_time) * 1000)

        return AIAnalysisResult(
            camera_uid=norm_frame.camera_uid,
            timestamp=norm_frame.timestamp,
            frame_sequence=norm_frame.frame_sequence,
            frame_quality=quality,
            detections=vehicles + persons,
            vehicles=vehicles,
            persons=persons,
            plates=plates,
            anomalies=anomalies,
            processing_time_ms=processing_time,
            model_provider=PROVIDER_MODE,
            overall_status="SUCCESS",
        )
