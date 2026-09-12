# Decision Log

## Use HLS for Video Streaming

### Date
2026-09-11

### Status
Accepted

### Context
The system needs to ingest raw RTSP streams from IP cameras and display them in a web browser. Browsers do not natively support RTSP.

### Options Considered
1. WebRTC
2. HTTP Live Streaming (HLS)
3. Motion JPEG (MJPEG)

### Decision
Use HLS (via FFmpeg transcoding to `.m3u8` and `.ts` chunks) served by the FastAPI backend as static files, and consumed by `hls.js` on the frontend.

### Reasoning
- **Simplicity**: HLS is easy to serve as standard static HTTP files without requiring complex STUN/TURN servers or WebSocket negotiation needed by WebRTC.
- **Reliability**: Highly robust for network interruptions.
- **Scalability**: Can be easily cached by CDNs if required later.

### Trade-offs
- **Latency**: HLS inherently introduces a few seconds of latency (glass-to-glass) due to chunking, whereas WebRTC is sub-second.

### Consequences
- Requires continuous FFmpeg processes running on the backend.
- Storage must handle rapid creation and deletion of small `.ts` files.

### Alternatives Rejected
- **WebRTC**: Rejected due to implementation complexity and infrastructure overhead for the MVP.
- **MJPEG**: Rejected because it consumes massive bandwidth and lacks audio support, making it unsuitable for a modern statewide deployment.

---

## Use Zustand for Frontend State

### Date
2026-09-11

### Status
Accepted

### Context
The dashboard requires sharing state (e.g., selected camera, active alerts) between deeply nested components (Map, Sidebar, Video Player). 

### Options Considered
1. React Context API
2. Redux
3. Zustand

### Decision
Use Zustand.

### Reasoning
- Less boilerplate than Redux.
- Prevents unnecessary re-renders that plague React Context when dealing with high-frequency updates (like telemetry or active alerts).

### Trade-offs
- Slight learning curve if developers are only familiar with Redux.

### Consequences
- State stores will be located in `/lib` or domain-specific folders.

### Alternatives Rejected
- **React Context**: Rejected due to performance issues with frequent state changes.
- **Redux**: Rejected due to excessive boilerplate for the current project scope.
