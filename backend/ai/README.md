# AI Orchestration Layer

Ported from `contrib/aneesh/backend/ai/README.md`. See docs/ai_pipelines.md §1 for the product-level version of this.

## Architecture
Video acquisition (`NormalizedFrame`, from `adapters/`) is decoupled from AI inference:
- `schemas.py` — strictly-typed canonical schemas (`DetectionResult`, `PlateResult`, `AIAnalysisResult`).
- `interfaces.py` — abstract base classes for AI providers (`VehicleDetector`, `PlateDetector`, etc).
- `orchestrator.py` — `AIOrchestrator` applies `AIProfile` rules (TRAFFIC vs SECURITY vs RTO) to decide which detectors run, handles the vehicle→plate→OCR pipeline, and evaluates confidence.

## Mock mode
Currently uses `MockVehicleDetector`, `MockPersonDetector`, etc. — static, synthesized detections so the orchestrator logic (profile gating, confidence math, quality gating) can be validated before real models exist.

## Real-model integration
1. Place model files under `backend/ai/models/` (create this directory when needed).
2. Implement a provider class against the relevant interface in `interfaces.py` (e.g. `class MyYOLOVehicleDetector(VehicleDetector):`).
3. Map your model's raw output into the canonical `DetectionResult`/`PlateResult`/`AnomalyResult` schema inside `detect()`/`recognize()`.
4. Adjust thresholds in `config.py` (`AI_PROFILES_CONFIG`, `OCR_CONFIDENCE_THRESHOLD`, etc.) if your model needs different cutoffs.
5. Swap the mock instantiation in `AIOrchestrator.__init__` for your real class.

Following this pattern keeps the orchestrator's pipeline logic (plate correlation, confidence reduction, quality assessment) unbroken when a mock is swapped for a real model.
