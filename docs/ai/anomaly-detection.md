# Anomaly Detection

**Status:** 🔵 MOCK 

## Purpose
Flag irregular behavior or security threats.

## Temporal Requirement
Unlike object detection which looks at a single static frame, anomaly detection usually requires context over time (e.g., determining if a person is "loitering" or a bag is "abandoned").
Future integration will likely require the `AnomalyDetector` adapter to maintain an internal buffer of the last N frames to feed into a 3D-CNN or temporal model.

## Open-Ended Labels
The `AnomalyResult` schema intentionally uses an open `anomaly_type` string rather than an Enum. We do not invent anomaly classes. Whatever classes the future teammate's model supports (e.g., `WRONG_WAY_DRIVING`, `CROWD_GATHERING`) will be passed directly through to the `AIAnalysisResult`.

## Expected Output
```json
{
  "anomaly_id": "ANM-999",
  "anomaly_type": "WRONG_WAY",
  "confidence": 0.75,
  "status": "DETECTED"
}
```
