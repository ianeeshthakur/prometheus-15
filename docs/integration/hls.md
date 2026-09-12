# HLS Integration

**Status:** 🟢 IMPLEMENTED

## Purpose
HTTP Live Streaming (HLS) is commonly used by modern web-based Video Management Systems (VMS) to distribute video over standard HTTP/HTTPS ports, avoiding firewall issues associated with RTSP.

## Implementation Details
The `HLSAdapter` (`backend/adapters/hls.py`) functions very similarly to the RTSP adapter. OpenCV natively supports reading `.m3u8` playlist files over HTTP.

- It connects to the web-hosted stream.
- It parses the playlist and pulls the underlying `.ts` video segments.
- It decodes them into identical `NormalizedFrame` arrays.

Because both RTSP and HLS output the exact same Normalized format, the AI Orchestrator does not need to know which protocol delivered the frame.
