# High-Level Architecture

This document separates the current prototype implementation from the proposed production scaling model.

## 1. Current Prototype Architecture (Hackathon)
**Status:** 🟢 IMPLEMENTED

The current implementation runs as a monolithic backend (FastAPI) and a frontend web application (Next.js).

```mermaid
graph TD
    subgraph Cameras [CCTV Endpoints]
        RTSP(RTSP Camera)
        HLS(HLS VMS)
    end

    subgraph Backend [FastAPI Backend]
        API(REST API)
        DB[(SQLite DB)]
        
        subgraph Pipeline 2
            AF(Adapter Factory)
        end
        
        subgraph Pipeline 3
            AIO(AI Orchestrator)
        end
    end
    
    subgraph Frontend [Next.js Command Center]
        UI(React UI)
    end

    RTSP --> AF
    HLS --> AF
    API --> DB
    AF --> AIO
    UI <--> API
```

## 2. Production Architecture
**Status:** ⚪ PLANNED

To handle 80,000+ streams statewide, the architecture must transition to a distributed, horizontally scaled model.

```mermaid
graph TD
    subgraph Edge
        Cam[Cameras] --> VMS[Local VMS]
    end

    subgraph Ingestion [Kubernetes Ingestion Cluster]
        WorkerA[Adapter Worker 1]
        WorkerB[Adapter Worker N]
    end

    subgraph Streaming
        Kafka[Kafka Topic: NormalizedFrames]
    end

    subgraph AI [GPU Inference Cluster]
        AI1[Vehicle Node]
        AI2[Plate Node]
    end

    subgraph Storage
        PG[(PostgreSQL/PostGIS)]
    end

    VMS --> Ingestion
    WorkerA --> Kafka
    WorkerB --> Kafka
    Kafka --> AI
    AI --> PG
```

### Production Layer Breakdown
- **Stream Ingestion (Adapter Workers):** Dedicated stateless pods that only run `RTSPAdapter` or `VendorSDKAdapter` to decode frames.
- **Message Broker:** Extracted frames are passed over Kafka.
- **AI Analytics:** GPU-backed workers that consume `NormalizedFrames` and apply TensorRT/ONNX models.
- **Intelligence Layer:** Services that query VAHAN/eGujCop based on the emitted `AIAnalysisResult`.
