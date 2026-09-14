# AI Orchestration Layer

Ported from `contrib/aneesh/backend/ai/README.md`. See docs/ai_pipelines.md §1 for the product-level version of this.

## Architecture
Video acquisition (`NormalizedFrame`, from `adapters/`) is decoupled from AI inference:
- `schemas.py` — strictly-typed canonical schemas (`DetectionResult`, `PlateResult`, `AIAnalysisResult`).
- `interfaces.py` — abstract base classes for AI providers (`VehicleDetector`, `PlateDetector`, etc).
- `orchestrator.py` — `AIOrchestrator` applies `AIProfile` rules (TRAFFIC vs SECURITY vs RTO) to decide which detectors run, handles the vehicle→plate→OCR pipeline, and evaluates confidence.

## Pipeline 3 Components Status

- **YOLO26n License Plate Detector**: REAL (Configured). Performs license plate detection (`Class 0: license_plate`).
- **PaddleOCR**: NOT_CONFIGURED. Handles character recognition.
- **Vehicle Detector**: NOT_CONFIGURED (Stub).
- **Tracker**: STUB (Naive IoU implementation used as a fallback since ByteTrack is NOT_CONFIGURED).
- **Person Detector**: MOCK / NOT_CONFIGURED.
- **Anomaly Detector**: MOCK / NOT_CONFIGURED.
- **Frame Quality Gate**: REAL. Uses Laplacian variance for blur and mean intensity for brightness.
- **Confidence Filtering**: REAL. Combines detection confidence, OCR confidence, and frame quality to compute a final score.

## Real Model Metrics

**YOLO26n License Plate Detector**
- **Model**: YOLO26n
- **Task**: License Plate Detection (YOLO26n = license plate detection, PaddleOCR = character recognition, ByteTrack = object tracking)
- **Class**: `0 = license_plate`
- **Input size**: 640
- **Precision**: 99.53%
- **Recall**: 97.60%
- **mAP50**: 99.40%
- **mAP50-95**: 87.59%

> **These metrics are test-set metrics supplied by the model owner and do not guarantee field performance.**

## Mock Mode vs Real Mode
The orchestrator can switch between REAL and MOCK modes via `PROVIDER_MODE` in `config.py`.
- `MOCK` mode uses static, synthesized detections for end-to-end pipeline validation.
- `REAL` mode utilizes the actual models (e.g. YOLO26n) configured in `real_providers.py`, returning `NOT_CONFIGURED` gracefully for missing dependencies.

## Real-model integration
1. Place model files under `backend/ai/models/` (create this directory when needed).
2. Implement a provider class against the relevant interface in `interfaces.py` (e.g. `class MyYOLOVehicleDetector(VehicleDetector):`).
3. Map your model's raw output into the canonical `DetectionResult`/`PlateResult`/`AnomalyResult` schema inside `detect()`/`recognize()`.
4. Adjust thresholds in `config.py` (`AI_PROFILES_CONFIG`, `OCR_CONFIDENCE_THRESHOLD`, etc.) if your model needs different cutoffs.
5. Swap the mock instantiation in `AIOrchestrator.__init__` for your real class.

Following this pattern keeps the orchestrator's pipeline logic (plate correlation, confidence reduction, quality assessment) unbroken when a mock is swapped for a real model.
