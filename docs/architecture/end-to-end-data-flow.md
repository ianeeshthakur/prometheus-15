# End-to-End Data Flow

**Status:** 🟢 IMPLEMENTED (Pipelines 1-3) | ⚪ PLANNED (Pipelines 4-5)

This sequence diagram illustrates the lifecycle of a single video frame as it moves from physical hardware into actionable police intelligence.

```mermaid
sequenceDiagram
    participant Cam as CCTV Camera
    participant Reg as P1: Camera Registry
    participant Adap as P2: Adapter Factory
    participant AI as P3: AI Orchestrator
    participant DB as P4: Intelligence DB
    participant CC as P5: Command Center
    
    %% Setup Phase
    Note over Reg: Camera onboarded via CSV/API
    
    %% Ingestion Phase
    Adap->>Reg: Get credentials for camera_uid
    Reg-->>Adap: Returns internal rtsp_url
    Adap->>Cam: Connect to RTSP stream
    Cam-->>Adap: Raw Video Stream
    Adap->>Adap: Decode frame (cv2)
    Adap->>AI: Yields NormalizedFrame
    
    %% AI Phase
    AI->>AI: Check Frame Quality
    AI->>AI: Vehicle Detection (Mock/Real)
    AI->>AI: Plate Detection & OCR
    AI->>AI: Calculate Confidence
    AI-->>DB: Save AIAnalysisResult (PLANNED)
    
    %% Command Center Phase
    DB-->>CC: Emit WebSocket Alert (PLANNED)
```

## Flow Description

1. **Camera Registry (P1)** holds the truth about the camera's location and connection details.
2. **Adapter Factory (P2)** securely fetches the connection details (never exposing them to the frontend) and connects to the camera.
3. It standardizes the raw byte-stream into a `NormalizedFrame` (a numpy array with timestamps).
4. **AI Orchestrator (P3)** receives the frame, checks the camera's `AIProfile` (e.g. TRAFFIC), and routes it to the necessary providers.
5. The resulting insights (Vehicles, Plates, Anomalies) are bundled into an `AIAnalysisResult`.
6. *(PLANNED)* **Pipeline 4** will ingest this result, match it against watchlists, and store it.
7. *(PLANNED)* **Pipeline 5** will immediately alert the **Command Center**.
