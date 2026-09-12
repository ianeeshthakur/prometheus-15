# API Overview

This document describes the actual FastAPI routes available in the G-VISTA backend prototype.

## Camera Registry (Pipeline 1)

### `GET /api/cameras/`
- **Status:** 🟢 IMPLEMENTED
- **Purpose:** List all registered cameras.
- **Security:** Returns `CameraResponse` (strips `rtsp_url`).

### `GET /api/cameras/{camera_uid}`
- **Status:** 🟢 IMPLEMENTED
- **Purpose:** Get a single camera.
- **Security:** Returns `CameraResponse` (strips `rtsp_url`).

### `POST /api/cameras/`
- **Status:** 🟢 IMPLEMENTED
- **Purpose:** Manually onboard a single camera.
- **Request:** `CameraCreate` (contains `rtsp_url`).
- **Response:** 201 Created. 409 Conflict if `camera_uid` already exists.

### `POST /api/cameras/bulk/csv`
- **Status:** 🟢 IMPLEMENTED
- **Purpose:** Bulk import cameras from a CSV file.
- **Security:** Upload File form data. Idempotent upsert.

### `POST /api/cameras/bulk/json`
- **Status:** 🟢 IMPLEMENTED
- **Purpose:** Bulk import from a JSON array.

## Adapters (Pipeline 2)

### `GET /api/cameras/{camera_uid}/adapter/health`
- **Status:** 🟢 IMPLEMENTED
- **Purpose:** Diagnostic endpoint. Securely resolves the camera adapter, connects to the stream, attempts to read one frame, and returns the health status.
- **Security:** Never exposes the stream URL to the caller.

## Streams (Legacy / Display)

### `POST /api/streams/start/{camera_uid}`
- **Status:** 🟢 IMPLEMENTED
- **Purpose:** Spawns an FFmpeg process to generate an HLS `.m3u8` playlist for the frontend Command Center UI to view.

### `POST /api/streams/stop/{camera_uid}`
- **Status:** 🟢 IMPLEMENTED
- **Purpose:** Kills the background FFmpeg process.

## AI Analytics (Pipeline 3)

### `GET /api/ai/health`
- **Status:** 🟢 IMPLEMENTED
- **Purpose:** Returns the status of the AI Orchestrator and the mock providers.

### `GET /api/ai/config`
- **Status:** 🟢 IMPLEMENTED
- **Purpose:** Dumps active threshold configurations and `AIProfiles`.

### `POST /api/ai/analyze-frame`
- **Status:** 🟢 IMPLEMENTED
- **Purpose:** Dev endpoint to manually push a test frame configuration through the entire AI pipeline and receive the `AIAnalysisResult`.

## Alerts & Investigations (Pipeline 5)
- **Status:** ⚪ PLANNED (No endpoints currently implemented).
