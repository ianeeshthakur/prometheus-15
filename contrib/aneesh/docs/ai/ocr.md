# OCR (Number Plate Recognition)

**Status:** 🔵 MOCK 

## Purpose
Extract text from a tightly cropped image of a license plate.

## The Quality Rule
The `AIOrchestrator` explicitly calculates `FrameQuality` (checking blur and brightness). If the frame is `POOR` or the OCR confidence drops below the threshold, the system flags the result as `UNREADABLE`. 
**The system never hallucinates a license plate number.**

## Raw vs Normalized Text
The OCR provider must return two formats:
- `raw_text`: Exactly what the model saw (e.g., `"GJ 05 XX 7821"` or `"GJ-05-XX-7821"`)
- `normalized_text`: The alphanumeric stripped version for database matching (e.g., `"GJ05XX7821"`).

## Expected Output
The data is embedded into the `PlateResult` schema by the Orchestrator:
```json
{
  "raw_text": "GJ 05 XX 7821",
  "normalized_text": "GJ05XX7821",
  "ocr_confidence": 0.85,
  "status": "READABLE"
}
```
