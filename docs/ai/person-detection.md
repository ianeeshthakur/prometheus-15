# Person Detection

**Status:** 🔵 MOCK 

## Purpose
Identify human figures in the frame.

## Where it sits in Pipeline 3
It is primarily used in the `SECURITY` profile. It runs in parallel to the `AnomalyDetector`.

## Expected Output
A list of `DetectionResult` schemas with `class_name="PERSON"`.

## Future Integration
The custom model adapter must ensure it filters out non-person classes (like animals or bicycles) unless those are specifically requested by the orchestrator configuration.
