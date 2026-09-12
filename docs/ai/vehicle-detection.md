# Vehicle Detection

**Status:** 🔵 MOCK 

## Purpose
Detect the presence, bounding box, and confidence of vehicles in a single frame.

## Where it sits in Pipeline 3
It is the first step in the `TRAFFIC` profile.
If it finds a vehicle, it returns the bounding box. The Orchestrator uses this box to create a crop for the `PlateDetector`. If no vehicles are found, the Plate and OCR detectors are skipped entirely for that frame.

## Expected Output
A list of `DetectionResult` schemas.

```json
{
  "detection_id": "VEH-1234",
  "class_name": "VEHICLE",
  "confidence": 0.95,
  "bbox": [100, 200, 300, 400],
  "model_provider": "MOCK"
}
```

## Future Integration
A future model (e.g. YOLOv8) will need to collapse classes like `car`, `bus`, `truck`, `motorcycle` into the `VEHICLE` canonical class name to remain compatible with the `AIAnalysisResult`.
