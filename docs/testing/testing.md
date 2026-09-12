# Testing

The backend includes comprehensive test suites designed to verify architecture limits and security isolations without requiring physical hardware.

## Pipeline 1 Regression (`test_api.py`)
- **Status:** 🟢 PASS
- **Verifies:**
  1. Manual Camera API onboarding.
  2. Duplicate `camera_uid` conflicts (Returns 409).
  3. Bulk JSON import (Verifies idempotency).
  4. Bulk CSV import.

## Pipeline 2 Adapters (`test_adapters.py`)
- **Status:** 🟢 PASS
- **Verifies:**
  1. `AdapterFactory` routes RTSP cameras to `RTSPAdapter`.
  2. `AdapterFactory` routes HLS cameras to `HLSAdapter`.
  3. `ONVIFAdapter` and `VendorSDKAdapter` safely catch execution and return `UNSUPPORTED`.
  4. Missing cameras correctly return 404.
  5. The Sentinel Demo camera correctly attempts a connection and times out gracefully (returning `OFFLINE`).

## Pipeline 3 AI Analytics (`test_ai.py`)
- **Status:** 🟢 PASS
- **Verifies:**
  1. Health and Configuration endpoints are active.
  2. **TRAFFIC Profile Testing**: Verifies that Person and Anomaly models are skipped, while Vehicles and Plates are processed. Verifies frame quality logic returns `GOOD` for clean noise, yielding a `READABLE` plate.
  3. **SECURITY Profile Testing**: Verifies that Vehicles/Plates are skipped, while Person and Anomaly detections trigger successfully.
  4. Profile Enum rejection (422 Invalid Profile).
