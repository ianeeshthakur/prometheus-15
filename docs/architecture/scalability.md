# Scalability

**Status:** ⚪ PLANNED (Production Architecture)

The current G-VISTA repository is a local prototype demonstrating end-to-end functionality. It cannot physically process 80,000 live HD streams on a single machine. 

This document outlines how the architecture is designed to scale in production.

## 1. Stateless Adapters
The `AdapterFactory` and its child adapters (`RTSPAdapter`) are entirely stateless. They do not maintain long-running loops internally. When requested, they `connect()`, `read_frame()`, and `close()`. This allows them to be deployed as thousands of tiny Serverless Functions or Kubernetes Pods.

## 2. Frame Sampling vs Continuous Decoding
Not every camera needs AI inference at 30 FPS.
- The `AI_TARGET_FPS` and `AI_FRAME_SKIP` configurations dictate that we only process a fraction of the frames (e.g., 5 frames per second).
- The AI Engine processes selected frames, freeing up CPU/GPU cycles.

## 3. Worker-Based Model Loading
Models are massive (100MB to several GB). 
- **Rule:** Do not load model weights inside every `process_frame()` call.
- **Production Architecture:** GPU workers will load the YOLO/PaddleOCR weights *once* into VRAM during `initialize()`, and then process thousands of `NormalizedFrames` sequentially.

## 4. Metadata Over Video Storage
G-VISTA does **not** store every video frame as a BLOB in SQLite/PostgreSQL. 
- It stores **Event Metadata** (e.g., `AIAnalysisResult`).
- Video storage remains the responsibility of the physical NVRs. We only store thumbnail crops of detection events (like a number plate).

## 5. Horizontal Scaling
```mermaid
graph TD
    subgraph Node 1
        W1[Adapter Worker] --> K1[Kafka]
    end
    subgraph Node N
        W2[Adapter Worker] --> K1
    end
    subgraph GPU Cluster
        K1 --> G1[AI Worker (YOLO)]
        K1 --> G2[AI Worker (PaddleOCR)]
    end
```
By decoupling Pipeline 2 (Adapters) from Pipeline 3 (AI) via a message queue, the system can scale ingest servers independently from expensive GPU inference servers.
