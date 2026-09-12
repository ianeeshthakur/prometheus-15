# Security

## 🟢 IMPLEMENTED Security Mechanisms

### 1. RTSP Credential Isolation
The system correctly ensures that `rtsp_url` is a private, backend-only variable.
- The `CameraResponse` Pydantic schema strictly drops this field before it is serialized to JSON.
- The React frontend does not possess the credentials. If an operator's machine is compromised, the RTSP feeds are not.

### 2. Stream Proxying
Instead of sending RTSP URLs to the browser (which exposes credentials and rarely works natively), the backend proxy uses `FFmpegRunner` to transcode the stream locally and serve secure `.m3u8` chunks over HTTP.

### 3. Graceful Failure
Adapter errors (e.g. OpenCV failing to open a stream) are caught and handled securely. They return an `OFFLINE` status via the API instead of crashing the process and potentially dumping stack traces containing credentials.

## ⚪ PLANNED / RECOMMENDED Security Mechanisms

The following are required before deploying to production:

### 1. Authentication & Authorization
Currently, the REST API endpoints are unauthenticated to facilitate hackathon velocity. JWT-based authentication (OAuth2) with Role-Based Access Control (RBAC) must be implemented. A traffic operator should not have permission to execute `DELETE /api/cameras/`.

### 2. Encryption at Rest
The internal database currently stores credentials in plaintext. These should be AES-encrypted in PostgreSQL.

### 3. API Rate Limiting
No rate limiting is currently enforced on the AI inference or stream spawning endpoints, which could lead to resource exhaustion attacks.
