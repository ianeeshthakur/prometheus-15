# G-VISTA Backend Pipeline Map

This document serves as the architectural map of the G-VISTA backend pipelines. It explicitly details the responsibilities and boundaries of the five distinct processing pipelines to ensure correct code placement and prevent boundary leakage.

## 1. Pipeline Overview

| Pipeline | Name | Main Code Location | Input | Output | Responsibility | Status |
|---|---|---|---|---|---|---|
| **Pipeline 1** | Camera Registry | `routers/cameras.py`, `services/`, `models.py` | Camera Configuration / JSON / CSV | SQLAlchemy `Camera` DB Record | Camera onboarding, metadata management, and single source of truth for camera configuration. | 🟢 IMPLEMENTED |
| **Pipeline 2** | Protocol Normalization | `adapters/`, `routers/adapters.py` | `Camera` DB Record + Raw Stream (RTSP, HLS, etc.) | Canonical `NormalizedFrame` | Convert heterogeneous sources into a normalized frame interface for AI ingestion. | 🟢 IMPLEMENTED |
| **Pipeline 3** | AI Video Analytics | `ai/`, `video/`, `routers/ai.py` | `NormalizedFrame` | `AIAnalysisResult` | Run detection models (YOLO, OCR, Anomaly) on frames to determine *what* is physically visible. | 🟢 IMPLEMENTED |
| **Pipeline 4** | Intelligence & Correlation | `intelligence/`, `routers/intelligence.py` | `AIAnalysisResult` | `IntelligenceEvent` | Extract entities, apply watchlist matching, correlate events across cameras, and provide semantic context. | 🟢 IMPLEMENTED |
| **Pipeline 5** | Operations & Investigation | `operations/`, `routers/operations.py` | `IntelligenceEvent` | `Alert`, `Investigation`, `TimelineEntry` | Human-in-the-loop workflows. Alerts, audit trails, evidence tracking, and case management. | 🟢 IMPLEMENTED |

## 2. Directory Structure

```text
backend/
├── models.py                   ← Pipeline 1 (Camera DB models)
├── schemas.py                  ← General Schemas (P1-P5)
├── routers/
│   ├── cameras.py              ← Pipeline 1 (Registry APIs)
│   ├── streams.py              ← Pipeline 2 (Stream control APIs)
│   ├── adapters.py             ← Pipeline 2 (Adapter health APIs)
│   ├── ai.py                   ← Pipeline 3 (AI inference APIs)
│   ├── intelligence.py         ← Pipeline 4 (Correlation APIs)
│   └── operations.py           ← Pipeline 5 (Investigation APIs)
├── services/                   ← Pipeline 1 (Camera onboarding/upsert)
├── adapters/                   ← Pipeline 2 (Protocol Normalization)
│   ├── rtsp.py                 ← RTSP Adapter
│   ├── hls.py                  ← HLS Adapter
│   └── factory.py              ← Adapter Factory
├── video/                      ← Pipeline 3 (Stream manager & frame processing)
├── ai/                         ← Pipeline 3 (Models & detection logic)
├── intelligence/               ← Pipeline 4 (Correlation, context, and watchlists)
└── operations/                 ← Pipeline 5 (Alerts and investigation state machine)
```

## 3. Pipeline Boundaries & Data Flow

```text
Pipeline 1 [Camera Registry]
       ↓ (Camera DB Record)
Pipeline 2 [Protocol Normalization]
       ↓ (NormalizedFrame)
Pipeline 3 [AI Video Analytics]
       ↓ (AIAnalysisResult)
Pipeline 4 [Intelligence & Correlation]
       ↓ (IntelligenceEvent)
Pipeline 5 [Operations & Investigation]
       ↓
Alert / Investigation / Evidence / Timeline (Human Review)
```

## 4. What Each Pipeline Answers

- **Pipeline 1:** "Which cameras exist and how are they registered?"
- **Pipeline 2:** "How do we convert heterogeneous camera sources into a common frame representation?"
- **Pipeline 3:** "What is physically visible in this raw frame?"
- **Pipeline 4:** "What does this observation mean in the context of our intelligence sources (e.g., watchlists)?"
- **Pipeline 5:** "What should an authorized human operator do with this intelligence?"

## 5. Where Should I Work?

When picking up a new task or debugging an issue, consult this guide:
- **If working on camera onboarding, manual imports, or CSV integration:** → Work in **Pipeline 1** (`routers/cameras.py`, `services/`, `models.py`)
- **If working on RTSP/HLS/ONVIF/vendor adapters or stream failures:** → Work in **Pipeline 2** (`adapters/`)
- **If working on AI models, OCR accuracy, anomaly logic, or inference:** → Work in **Pipeline 3** (`ai/`, `video/`)
- **If working on watchlists, entity correlation across cameras, or semantic alerts:** → Work in **Pipeline 4** (`intelligence/`)
- **If working on human-in-the-loop workflows, UI alert statuses, investigations, or timelines:** → Work in **Pipeline 5** (`operations/`)

## 6. Do Not Cross Pipeline Boundaries!

To ensure long-term stability and correct architecture separation, follow these strict rules:
1. **Pipeline 3 (AI) must not contain investigation workflows.** It simply analyzes frames.
2. **Pipeline 4 (Intelligence) should not become the operator workflow.** It generates semantic events, but does not manage human UI states like "Acknowledged" or "Resolved".
3. **Pipeline 5 (Operations) must not contain AI detection or OCR logic.** It solely operationalizes downstream intelligence.
4. **Pipeline 4 must use authorized connector boundaries** (e.g., standard interfaces) rather than inventing hard-coded government APIs directly in the core logic.
5. **The Database is the Single Source of Truth.** Do not create parallel, in-memory legacy registries (like the old `camera_registry.py`). Pipeline 1 manages the canonical configurations.
