# ONVIF Integration

**Status:** 🟠 STUB / UNSUPPORTED BOUNDARY

## Purpose
ONVIF Profile S allows standard discovery and control of IP cameras. In G-VISTA, it would theoretically be used to discover the RTSP stream URL dynamically without requiring manual entry.

## Implementation Status
Currently, the `ONVIFAdapter` (`backend/adapters/onvif.py`) exists as an architectural boundary. Because we do not have an authorized physical ONVIF device on the development network, the adapter is hardcoded to return an `UNSUPPORTED` health state safely.

## Future Development
When implemented, it will likely use the `zeep` SOAP client or `onvif-zeep` Python libraries to query the camera's media profiles and retrieve the stream URIs dynamically.
