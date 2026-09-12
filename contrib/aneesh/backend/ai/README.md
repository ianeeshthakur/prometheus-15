# Pipeline 3: AI Orchestration Layer

This directory contains the AI Orchestration layer for the G-VISTA Gujarat Police CCTV project.

## Architecture
The system decouples the video acquisition (`NormalizedFrame`) from the actual AI inference.
- `schemas.py`: Defines the strictly-typed canonical schemas (`DetectionResult`, `PlateResult`, `AIAnalysisResult`).
- `interfaces.py`: Defines the abstract base classes for AI Providers (`VehicleDetector`, `PlateDetector`, etc).
- `orchestrator.py`: The `AIOrchestrator` applies `AIProfile` rules (e.g. TRAFFIC vs SECURITY) to determine which models run, handles crops, and evaluates confidence.

## Mock Mode
Currently, the system uses `MockVehicleDetector`, `MockPersonDetector`, etc. These return static, synthesized detections to allow the orchestrator logic to be tested and validated before real models are integrated.

## Real-Model Integration (Future Teammate Instructions)
To integrate your trained `.pt`, `.onnx`, or custom models:

1. **Place Model Files**: Put your model files inside `backend/ai/models/` (or wherever appropriate).
2. **Implement Provider**: Create a new class implementing the relevant interface from `interfaces.py`.
   - Example: `class MyYOLOVehicleDetector(VehicleDetector):`
3. **Map Outputs**: In your `detect()` method, wrap your raw model outputs inside the Canonical `DetectionResult` schema.
4. **Configure Thresholds**: Adjust `AI_PROFILES_CONFIG` or confidence thresholds in `config.py` if your model requires different cutoffs.
5. **Update Factory**: Swap the mock provider instantiation in `orchestrator.py` with your new class.
   - E.g. change `self.vehicle_detector = MockVehicleDetector()` to `self.vehicle_detector = MyYOLOVehicleDetector('models/my_yolo.pt')`.

By following this pattern, the pipeline logic (plate correlation, confidence reduction, quality assessment) remains unbroken.
