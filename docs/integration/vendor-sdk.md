# Vendor SDK Integration

**Status:** 🟠 STUB / UNSUPPORTED BOUNDARY

## Purpose
Some proprietary camera systems (like specific enterprise lines from Hikvision, CP Plus, or Dahua) encrypt their streams or require connection via proprietary C++ SDKs rather than standard RTSP.

## Implementation Status
The `VendorSDKAdapter` (`backend/adapters/vendor.py`) is an explicit integration boundary. It safely returns `UNSUPPORTED`. No real vendor SDKs are currently integrated.

## Future Development
Future developers will need to:
1. Obtain the `.so` or `.dll` libraries from the vendor.
2. Write Python `ctypes` wrappers around the SDK to call the authentication and frame-grabbing functions.
3. Convert the resulting raw byte buffers into numpy arrays.
4. Yield the standard `NormalizedFrame`.
