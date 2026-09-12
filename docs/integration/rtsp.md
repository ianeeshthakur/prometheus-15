# RTSP Integration

**Status:** 🟢 IMPLEMENTED

## Purpose
Real-Time Streaming Protocol (RTSP) is the de-facto standard for IP cameras. G-VISTA supports pulling frames directly from RTSP streams for backend AI processing.

## Implementation Details
The `RTSPAdapter` (`backend/adapters/rtsp.py`) utilizes headless OpenCV (`cv2.VideoCapture`) to connect to the stream.

- **URL Construction:** The system retrieves the `rtsp_url` from the database. It explicitly avoids logging this URL since it usually contains plaintext passwords (e.g., `rtsp://admin:password123@192.168.1.50:554/stream1`).
- **Connection Handling:** Wrapped in a `try/except` block with a timeout. If the camera goes offline, the adapter catches the exception and sets the health status to `OFFLINE` instead of crashing the FastAPI worker.
- **Frame Reading:** Generates standard BGR numpy arrays.
- **Cleanup:** Explicitly calls `cap.release()` during `close()` to prevent zombie connections and memory leaks.
