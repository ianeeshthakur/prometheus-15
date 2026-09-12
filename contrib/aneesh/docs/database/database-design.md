# Database Design

**Status:** 🟢 IMPLEMENTED (SQLite Prototype) | ⚪ PLANNED (PostgreSQL/PostGIS)

## Prototype Implementation
The current application uses SQLite with SQLAlchemy ORM (`backend/gvista.db`).

## ER Diagram

```mermaid
erDiagram
    CAMERA {
        Integer id PK
        String camera_uid UK "Unique deterministic ID"
        String name
        String department
        String district
        String location
        Float latitude "Nullable"
        Float longitude "Nullable"
        String vms_vendor
        ProtocolType protocol_type "Enum: RTSP, HLS, ONVIF, VENDOR_SDK"
        StatusType status "Enum: ACTIVE, INACTIVE, DEGRADED, OFFLINE"
        String rtsp_url "Private Stream Connection URI"
        Boolean ai_enabled
        DateTime created_at
        DateTime updated_at
    }

    AI_ANALYSIS_RESULT {
        String event_id PK "PLANNED"
        String camera_uid FK "PLANNED"
        DateTime timestamp
        String payload "JSON B"
    }

    CAMERA ||--o{ AI_ANALYSIS_RESULT : generates
```

## Security Design
The `rtsp_url` is stored in plaintext in the SQLite prototype to allow local testing. In production, this field may be AES-encrypted at rest to prevent database dumps from leaking critical police stream credentials.

## Planned Production Migration
To support spatial tracking and 80,000+ camera scaling, the system will migrate to **PostgreSQL**.
- `latitude`/`longitude` will be converted to PostGIS `Geometry` types.
- Events will be indexed by space and time for rapid correlation.
