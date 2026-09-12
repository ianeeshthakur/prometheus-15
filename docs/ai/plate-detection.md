# Number Plate Detection (LPR/ANPR Part 1)

**Status:** 🔵 MOCK 

## Purpose
Locate the specific bounding box of a license plate *within* an already detected vehicle crop.

## Where it sits in Pipeline 3
`VehicleDetector` → Vehicle Crop → **`PlateDetector`** → Plate Crop → `OCRProvider`.

## Why Separate Detection from OCR?
Attempting to run OCR on a full 1080p highway frame is computationally expensive and wildly inaccurate. By forcing the system to locate the vehicle, then crop it, then locate the plate, and crop it again, the OCR engine only processes a tiny, highly-relevant pixel array (e.g., 200x50 pixels).

## Expected Output
A dictionary containing the local `bbox` and `plate_detection_confidence`. This is then merged by the Orchestrator into the final `PlateResult` schema.
