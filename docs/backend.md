# G-VISTA — Backend

Governs backend architecture, the camera/adapter/database layer, APIs, security posture, and testing. Product scope lives in [prd.md](prd.md); AI detector contracts and the analytics/intelligence pipelines live in [ai_pipelines.md](ai_pipelines.md) — this file stops at "detections arrive as a `NormalizedFrame`/event" and hands off there.

Stack: **FastAPI + SQLAlchemy**, SQLite for local dev → **PostgreSQL + PostGIS** for anything spatial (Model 1 registry, gap-analysis).

**Ported from `contrib/aneesh/backend/` on 2026-09-12** (see `docs/prd.md` §15 decision log; that folder was removed from the repo on 2026-09-14 once its owner had it archived externally — the port below is complete and doesn't depend on it still being present). That folder held a real, working FastAPI backend (~2,100 lines) from the pre-rebuild `prometheus-1` migration; the adapters, AI orchestrator, camera registry, video streaming, and tests below are now live in `server/` itself, not just archived reference. Three things were fixed, not copied verbatim, during the port:

1. **The legacy in-memory `camera_registry` module was dropped**, not ported — it simulated one hardcoded demo camera from env vars, which duplicates and conflicts with the DB-backed Model 1 registry as single source of truth. The real replacement (an `/api/ingest` catalogue-sync service, §2) is still unbuilt — see §12.
2. **`routers/streams.py` was genuinely broken in the source** — it imported `from ai.detection_service import detection_service, ocr_service`, a module that was never committed anywhere in the migration, so the file would have raised `ImportError` on startup. The ported version wires the real `AIOrchestrator` (`ai/orchestrator.py`) instead.
3. **Flat `models.py`/`schemas.py`/`db.py` were split** into the `models/`, `schemas/`, `db/` packages this doc already specified, so only `camera.py` in each package is populated — the rest (`alert.py`, `event.py`, `investigation.py`, `watchlist.py`, `user.py`) remain the pre-existing empty stubs, since contrib had no equivalent to port.

Full before/after detail in `docs/prd.md` §15.

---

## 1. Integration model decision

The hackathon defines four reference integration models and explicitly allows — and rewards — hybrids. This project is:

**Model 1 (mandatory) + Model 2 (core) + Model 4 elements (analytics layer).**

- **Model 1 — Centralised CCTV Registry & GIS Foundation** (compulsory for every submission): a DB-backed camera registry (`server/models/camera.py`, `server/services/camera_service.py`) is the single source of truth for every camera regardless of which department or protocol owns it. It is metadata/registry-only — it does not itself stream video — and is paired below with Model 2 for the actual video path.
- **Model 2 — Unified Viewing & Selective Analytics** (direct integration, no middleware/federation layer): `server/adapters/` (`rtsp.py`, `hls.py`, `onvif.py`, `vendor.py`, behind `factory.py`) talk directly to each department's cameras/VMS per-protocol. This matches Model 2's explicit "no intermediate middleware" requirement.
- **Model 4 elements — Central AI Platform**: the AI orchestrator and intelligence layer (`server/ai/orchestrator.py`, `server/intelligence/`) form a centralized analytics layer sitting behind the direct (Model 2) integrations, so detections from every department flow into one alerting/investigation surface — the part of Model 4 worth keeping without adopting its "one consolidated VMS" storage/recording mandate, which is out of scope for a hackathon pilot.

Model 3 (VMS federation/middleware) is deliberately not adopted — it would duplicate what the adapter factory already does and contradicts Model 2's "no middleware" requirement, which is the model we're pairing with Model 1.

## 2. The real ingest API (hackathon simulated dataset)

Verified live at hackathon-provided infrastructure (prd.md §0.1). This is the actual integration target for `server/adapters/rtsp.py` and `server/adapters/hls.py` — not a hypothetical protocol to design against later.

- **Catalogue**: `GET /api/ingest` → camera id, location, codec, live status, stream properties, and all three stream URLs below, for each of the ~50 live-simulated feeds (drawn from 30+ real cameras × ~12h footage across Health/Police/GSRTC/Panchayat/Municipal).
- **RTSP** — `rtsp://<host>:8554/stream/<id>` — for AI inference (OpenCV, GStreamer, FFmpeg, DeepStream). Must be consumed **over TCP**, not UDP.
- **WebRTC (WHEP)** — `http://<host>:8889/stream/<id>/whep` — for low-latency browser preview (the natural fit for the Live Cameras player, frontend.md §3.2, rather than proxying RTSP into the browser).
- **HLS** — `http://<host>/live/stream/<id>/index.m3u8` — for dashboards, mobile, and restricted networks; the fallback player path when WHEP isn't viable.

### Pre-submission technical checklist (from the hackathon's own resource page — treat as acceptance criteria)

- [x] RTSP consumed over TCP, never UDP — enforced in `video/ffmpeg_runner.py` (`-rtsp_transport tcp`) and now also `adapters/rtsp.py` (`OPENCV_FFMPEG_CAPTURE_OPTIONS`, fixed §12.3) — both paths confirmed.
- [ ] Timestamp-based timing logic — `adapters/rtsp.py`/`hls.py` now prefer `CAP_PROP_POS_MSEC` over pure local read-time (fixed §12.3), but this is unverified against a real feed since none exists to test against yet; live RTSP commonly doesn't report a usable position, in which case it silently falls back to local time.
- [x] Reconnection with exponential backoff on every adapter — implemented in `video/stream_manager.py` for the FFmpeg/HLS path, and now also directly in `adapters/rtsp.py`/`hls.py` (fixed §12.3) so they no longer depend on external polling to recover from a drop.
- [ ] Mixed codec/resolution handling — not yet tested against real heterogeneous feeds (no real cameras connected yet).
- [x] Adapter health surfaced per-camera (protocol, last heartbeat, FPS, restart count) — `routers/adapters.py` (`/adapter/health`) and `video/stream_manager.get_stream_status()` both return this; feeds frontend.md §3.2/§3.7.
- [ ] Error reporting capturing camera id, exact URL, client + version, UTC timestamp, and client-side error log — not yet implemented as a structured format; currently just Python `logger` calls.

## 3. Adapter contracts (`server/adapters/`)

Every adapter normalizes its protocol into the same `NormalizedFrame` shape so the AI orchestrator (ai_pipelines.md §1) never needs to know which protocol produced a frame.

- **RTSP** (`rtsp.py`, real, ported+fixed) — headless OpenCV capture, credential handling (URL kept instance-private, never returned), TCP-forced, self-reconnect-with-backoff, stream-relative timestamps (§12.3). Primary adapter against the real ingest API (§2).
- **HLS** (`hls.py`, real, ported+fixed) — `.m3u8` ingestion into the same `NormalizedFrame` shape as RTSP, same reconnect/timestamp fixes as RTSP (§12.3); used for the dashboard/mobile/restricted-network path.
- **ONVIF** (`onvif.py`, ported) — explicitly returns `UNSUPPORTED`, not faked. [ ] Profile S discovery/media negotiation — not yet built; no authorized ONVIF test hardware available.
- **Vendor SDK** (`vendor.py`, ported) — explicitly returns `UNSUPPORTED`, not faked. [ ] ctypes wrapper strategy — [ ] decide which vendor to implement first once real vendor VMS access is available.
- **Factory** (`factory.py`, real, ported+adapted) — resolves the adapter by DB-registry lookup only (legacy in-memory fallback dropped, see §0).
- **Discovery/normalization** (`integration/discovery_adapter.py`, real, ported) — `SentinelCameraSource.normalize()` maps arbitrary catalogue JSON/CSV rows into `CameraCreate`, with per-field validation errors (used by the bulk CSV/JSON importers in `routers/cameras.py`). [ ] True network-scan/WS-Discovery auto-onboarding is a separate, still-unbuilt capability despite the module name (kept for continuity with the original migration).

## 4. Data layer

- Postgres, extended with **PostGIS**, is the target for anything spatial (Model 1's GIS registry, the coverage gap-analysis report, department/district spatial queries; suggested by the hackathon's own stack list). SQLite (current `.env.example` default) stays the local-dev default.
- [x] **Migration written**: `server/migrations/001_postgis_setup.sql` — enables the extension, adds a `geom geometry(Point, 4326)` column alongside the existing lat/lng floats, backfills it, adds a GIST index, and a trigger to keep it in sync on insert/update. **Unverified against a real Postgres instance** — none is available in this dev environment; review/dry-run before applying anywhere that matters. Doesn't touch the SQLite path at all — `models/camera.py` keeps plain float columns regardless of which DB is configured.
- All 6 registry-adjacent models are now real: `camera.py` (department, district, protocol, vendor, geolocation, status, `ai_enabled`, `ai_profile`), `watchlist.py` (`WatchlistEntry` + `WatchlistMatch`), `user.py` (`User` + `AuditLogEntry`), `event.py` (`CameraEvent`), `alert.py` (`Alert`), `investigation.py` (`Investigation` + `InvestigationEvidence`), `admin_settings.py` (`FacialRecognitionAuthorization`) — each backed by a `schemas/*.py` Pydantic pair. Built during the §12.4 build-out (2026-09-12), designed against `lib/types.ts`'s frontend shapes where one already existed (`Alert`, `CameraEvent`), and against `docs/frontend.md`'s textual spec where it didn't (`Investigation` — that page was still a placeholder when this was written).
- [x] Onboarding source is now a stored column on `Camera` (`onboarding_source`: `MANUAL` / `BULK_CSV` / `BULK_JSON` / `API_INGEST`, set server-side per endpoint, never client-settable) — closed docs/backend.md §12.5.
- [x] **ER diagram** (below) — 7 models now have real schemas; `Timeline`/`Map trace` deliberately have no boxes of their own since they're derived queries, not tables (`models/investigation.py`'s docstring).

```mermaid
erDiagram
    Camera ||--o{ CameraEvent : "camera_uid"
    Camera ||--o{ Alert : "camera_uid"
    WatchlistEntry ||--o{ WatchlistMatch : "watchlist_entry_id"
    WatchlistEntry |o--o{ Alert : "watchlist_entry_id (optional)"
    Investigation ||--o{ InvestigationEvidence : "investigation_id"
    Investigation |o--o{ Alert : "investigation_id (optional, set when opened from an alert)"
    CameraEvent |o--o{ InvestigationEvidence : "reference_event_id (optional)"
    User |o--o{ AuditLogEntry : "user_id (optional, denormalized username survives deletion)"
    User |o--o{ FacialRecognitionAuthorization : "authorized_by (username, not FK)"

    Camera {
        int id PK
        string camera_uid UK
        string department
        string district
        string protocol_type
        string status
        string ai_profile
        string onboarding_source
        float latitude
        float longitude
        string rtsp_url "never serialized to a response"
    }
    CameraEvent {
        int id PK
        string event_uid UK
        string camera_uid FK
        string event_type
        string identifier "normalized plate -- what entity_graph.py correlates on"
        float confidence
    }
    Alert {
        int id PK
        string alert_uid UK
        string severity
        string type
        string camera_uid FK
        int watchlist_entry_id FK "nullable"
        int investigation_id FK "nullable"
        string status
    }
    WatchlistEntry {
        int id PK
        string identifier
        string category
        string risk_level
        bool active
    }
    WatchlistMatch {
        int id PK
        int watchlist_entry_id FK
        string camera_uid
        string matched_value
    }
    Investigation {
        int id PK
        string case_uid UK
        string entity "what Timeline/Trace query CameraEvent/Alert by"
        string status
        string priority
    }
    InvestigationEvidence {
        int id PK
        int investigation_id FK
        string evidence_type
        int reference_event_id FK "nullable"
    }
    User {
        int id PK
        string username UK
        string role "ADMIN or OPERATOR"
        string department_scope "nullable, OPERATOR only"
    }
    AuditLogEntry {
        int id PK
        int user_id FK "nullable"
        string action
        string resource_type
    }
    FacialRecognitionAuthorization {
        int id PK
        bool enabled
        string authorized_by
        string reason "required"
    }
```

## 5. Pipelines owned by the backend

(Pipelines 3 and 4 — AI video analytics and intelligence correlation — are AI-domain and live in ai_pipelines.md.)

### Pipeline 1 — Camera registry
Camera onboarding via manual entry, CSV/JSON bulk import, and the `/api/ingest` catalogue (§2) — all three paths required by Model 1. `camera_uid` is the deterministic key; upserts must be idempotent (re-importing the same catalogue must not create duplicates).
- [x] Manual (`POST /api/cameras/`), CSV (`POST /api/cameras/import/csv`), and JSON (`POST /api/cameras/import/json`) onboarding all implemented and tested (`tests/test_cameras.py`).
- [x] Idempotent upsert by `camera_uid` — `services/camera_service.upsert_camera()`, with a race-condition retry on `IntegrityError`.
- [x] `/api/ingest` catalogue sync — `integration/ingest_sync.py` + `POST /api/cameras/sync-ingest` (admin-only). **Unverified against the real endpoint**: `INGEST_API_BASE_URL` is unset until organizers publish a live host; calling the endpoint unconfigured returns a clear 400, not a silent no-op (tested). The field-mapping guesses at the undocumented parts of the payload shape (department/vms_vendor aren't in the documented fields) — expect to adjust once a real payload can be inspected.
- [x] Gap-analysis query — `services/camera_service.get_gap_analysis()` + `GET /api/cameras/gap-analysis`, real coverage-shortfall report by district × department (docs/frontend.md §3.1 Row 4 / §3.7), tested.

### Pipeline 2 — Protocol normalization
The adapter factory (`server/adapters/factory.py`) selects RTSP/HLS/ONVIF/Vendor-SDK per camera and normalizes output into `NormalizedFrame` before handing off to the AI orchestrator.
- [x] Factory dispatch logic + `NormalizedFrame` schema — implemented; RTSP/HLS paths real, ONVIF/Vendor explicitly `UNSUPPORTED` per §3.
- [x] Frame-rate pacing — `video/frame_sampler.py`'s `FrameSampler` wraps an adapter and caps reads at `AI_TARGET_FPS`, replacing the inline `asyncio.sleep()` `routers/streams.py` used to do this with.

### Pipeline 5 — Alerts & investigation
Alert severity scoring, delivery, and investigation case-file CRUD backing frontend.md §3.3/§3.5 — **all built** during the 2026-09-12 §12.4 pass, verified end-to-end in `tests/test_investigations.py` and `tests/test_alerts.py`.
- [x] Live event delivery — `routers/streams.py`'s `/api/streams/events/stream` SSE endpoint + `intelligence/alert_engine.py` pub/sub, wired to the real `AIOrchestrator` output.
- [x] Watchlist matching — real DB lookup via `intelligence/watchlist_matcher.py`, exact match only (fuzzy matching deliberately deferred, see that file's docstring).
- [x] **Severity scoring rubric** (`services/alert_service.py`): WATCHLIST_MATCH uses the matched entry's real `risk_level`; ANOMALY uses a type→severity map (`WRONG_WAY`→CRITICAL, `UNATTENDED_OBJECT`→HIGH, `CROWD`/`LOITERING`→MEDIUM, unmapped types→MEDIUM default — `anomaly_type` stays an open string per ai_pipelines.md §2, so this never errors on an unrecognized type); routine unmatched plate/person detections deliberately do **not** become alerts (7 C's "Courteous" — don't cry wolf), just a persisted `CameraEvent`.
- [x] **Alert persistence** — `models/alert.py` + `services/alert_service.py`; every watchlist match and anomaly now creates a real, queryable `Alert` row (`GET/PATCH /api/alerts/*`), not just an SSE broadcast. Every event (matched or not) is separately persisted as a `CameraEvent` (`services/event_service.py`) — this is what closed the original "events broadcast live but never written to a DB table" gap.
- [x] **Case-file CRUD + evidence** — `models/investigation.py` (`Investigation` + `InvestigationEvidence`), `services/investigation_service.py`, `routers/investigations.py`: create/list/status, evidence attach/list, `POST /api/alerts/{alert_uid}/investigation` to open a case directly from an alert (auto-sets priority from severity). Timeline and Map Trace (frontend.md §3.5) are *derived*, not separate tables — queried from `CameraEvent`/`Alert` rows matching the case's `entity`, via `intelligence/entity_graph.py`'s `trace_entity()`. That trace function is exact-identifier correlation (today: normalized plate), not graph-theoretic re-identification — appearance-based re-id (ai_pipelines.md §5 differentiator) isn't built, so that's honestly as far as "cross-camera correlation" goes right now. It's still the real shape of the hackathon's graded live vehicle-tracking test (docs/prd.md §0.1); verified end-to-end against synthetic data in `tests/test_investigations.py` since no real ingest-API camera exists to test against yet.

## 6. API surface (`server/routers/`)

**Implemented and wired into `main.py`** (verified against the actual router files as of the port, 2026-09-12 — keep this table current, don't let it drift):

| Method | Path | Router | Notes |
|---|---|---|---|
| GET | `/api/cameras/` | `cameras.py` | filterable by department/district/protocol_type/vms_vendor/status |
| GET | `/api/cameras/{camera_uid}` | `cameras.py` | 404 if not found |
| POST | `/api/cameras/` | `cameras.py` | manual onboarding, 409 on duplicate `camera_uid` |
| POST | `/api/cameras/import/csv` | `cameras.py` | bulk CSV, idempotent upsert |
| POST | `/api/cameras/import/json` | `cameras.py` | bulk JSON, idempotent upsert — same shape the future `/api/ingest` sync would call |
| GET | `/api/cameras/{camera_uid}/adapter/health` | `adapters.py` | live adapter connect+read diagnostic, never returns `rtsp_url` |
| POST | `/api/streams/{camera_id}/start` | `streams.py` | starts FFmpeg HLS transcode + (if `ai_enabled`) the AI pipeline background task |
| POST | `/api/streams/{camera_id}/stop` | `streams.py` | |
| GET | `/api/streams/{camera_id}/status` | `streams.py` | FPS, uptime, restart count |
| GET | `/api/streams/events/stream` | `streams.py` | Server-Sent Events, live AI events + alerts |
| GET | `/api/ai/health` | `ai.py` | provider readiness (all `MOCK_READY` today) |
| GET | `/api/ai/config` | `ai.py` | active profiles |
| POST | `/api/ai/analyze-frame` | `ai.py` | test endpoint, synthesizes a dummy frame — exercises the orchestrator without a camera |
| GET | `/api/health/` | `health.py` | CPU/memory/ffmpeg-availability |
| GET | `/api/watchlists/` | `watchlists.py` | list, filterable by category/active_only |
| POST | `/api/watchlists/` | `watchlists.py` | create an entry |
| POST | `/api/auth/login` | `auth.py` | returns a JWT |
| GET | `/api/auth/me` | `auth.py` | current user, requires auth |
| POST | `/api/auth/users` | `auth.py` | admin-only |
| GET | `/api/auth/users` | `auth.py` | admin-only |
| GET | `/api/cameras/gap-analysis` | `cameras.py` | real coverage-shortfall report |
| POST | `/api/cameras/sync-ingest` | `cameras.py` | admin-only, pulls the real `/api/ingest` catalogue (§2) |
| GET | `/api/alerts/` | `alerts.py` | filterable by severity/status/district/camera_uid |
| GET | `/api/alerts/{alert_uid}` | `alerts.py` | |
| PATCH | `/api/alerts/{alert_uid}/status` | `alerts.py` | requires auth, writes an audit-log entry |
| POST | `/api/alerts/{alert_uid}/investigation` | `alerts.py` | opens a case from an alert, requires auth |
| GET | `/api/investigations/` | `investigations.py` | filterable by status/entity |
| POST | `/api/investigations/` | `investigations.py` | requires auth |
| GET | `/api/investigations/{case_uid}` | `investigations.py` | |
| PATCH | `/api/investigations/{case_uid}/status` | `investigations.py` | requires auth |
| GET | `/api/investigations/{case_uid}/timeline` | `investigations.py` | derived from CameraEvent + Alert rows |
| GET | `/api/investigations/{case_uid}/trace` | `investigations.py` | the graded vehicle-tracking test's shape |
| GET/POST | `/api/investigations/{case_uid}/evidence` | `investigations.py` | POST requires auth |
| GET | `/api/admin/facial-recognition` | `admin.py` | current status + full authorization history |
| POST | `/api/admin/facial-recognition/authorize` | `admin.py` | admin-only, requires a stated reason |
| GET | `/api/admin/audit-log` | `admin.py` | admin-only |
| GET | `/api/admin/gov-lookup/{vahan\|sarthi\|egujcop\|afis\|nafis}/{id}` | `admin.py` | admin-only, always returns a clearly-labeled mock |
| GET | `/` | `main.py` | liveness |

**Every named router is now built and wired.** All routers from the original stub list (`auth.py`, `alerts.py`, `investigations.py`, `watchlists.py`) plus a new one not in that list (`admin.py`, for the facial-recognition gate — docs/frontend.md §3.8 and docs/prd.md §13.2 both call for a real, visible toggle here, not just a policy sentence).

## 7. Security & privacy posture

- No credential or raw camera IP ever reaches the browser (carried forward unchanged from the project's original rules).
- [x] **Auth + RBAC** — `core/security.py` (JWT via `pyjwt`, password hashing via `bcrypt` directly — not `passlib`, see requirements.txt's comment for why), `models/user.py` (`User`: `ADMIN` sees every department, `OPERATOR` is scoped to one via `department_scope`). A first `ADMIN` account is bootstrapped automatically on a fresh DB from `ADMIN_BOOTSTRAP_USERNAME`/`ADMIN_BOOTSTRAP_PASSWORD` (loud, obvious defaults — override before any real use) since there's otherwise no way to log in at all. **Auth is now required on every route that reads or writes registry/watchlist/alert/investigation/adapter data** (docs/backend.md §12.5 closed the earlier gap) — only `GET /`, `GET /api/health/`, and `GET /api/ai/*`'s diagnostic endpoints stay open, matching common liveness/readiness-probe practice.
- [x] **Role-based search** (frontend.md §3.7) — actually enforced now, not just modeled: `GET /api/cameras/` and `GET /api/cameras/{camera_uid}` apply an `OPERATOR`'s `department_scope` server-side regardless of what the caller requests (`services/camera_service.list_cameras`'s `department_scope` param overrides the `department` filter; direct lookup of an out-of-scope camera is a 403, not a silent 200). Tested in `tests/test_cameras.py::test_operator_department_scope_enforced`.
- [x] **Audit log** — `models/user.AuditLogEntry` + `core/security.log_action()`, `GET /api/admin/audit-log`. Wired into every write action (login, user/camera/watchlist creation, alert status changes, investigation creation/status/evidence, stream start/stop, ingest sync, facial-recognition authorization) **and** into viewing one specific alert or investigation (`ALERT_VIEWED`, `INVESTIGATION_VIEWED`). Deliberately **not** wired into list endpoints — logging every page of a triage queue someone scrolls through is volume without much audit value; logging that they opened *this specific* alert/case is the meaningful signal. This was a judgment call, not an oversight — revisit if it turns out "every alert view" in frontend.md §3.8 meant something more literal.
- [x] **Facial recognition / biometric identification** — gated behind an explicit authorization workflow, never a default (`is_currently_enabled()` returns `False` when no authorization row exists at all). `models/admin_settings.FacialRecognitionAuthorization`: each row is one authorization *event* (grant or revoke) with a required `reason` and `authorized_by`, not a single mutable flag — the table itself is the audit trail. `GET/POST /api/admin/facial-recognition*`, admin-only to authorize. Grounded in India's DPDP Act, 2023 and the Puttaswamy privacy judgment.
- [x] **Mock government database lookups** — `integration/mock_gov_adapters.py` (VAHAN, SARTHI, eGujCop, AFIS, NAFIS), `GET /api/admin/gov-lookup/*`. Every response carries `"mock": true` and an explanatory message; no real credentialed access exists or is attempted.

### 7.1 Threat model (consolidated 2026-09-12, docs/backend.md §12.5)

What this section protects against, what it explicitly doesn't yet, and why -- one place instead of scattered across commit messages.

| Threat | Mitigation | Status |
|---|---|---|
| Unauthenticated access to camera locations, watchlist entries, alerts, investigations | JWT auth required on every registry/watchlist/alert/investigation/adapter route | Done, tested |
| An `OPERATOR` reading another department's cameras | `department_scope` enforced server-side, not just modeled | Done, tested |
| Credential/raw camera IP (`rtsp_url`) leaking to the frontend | `CameraResponse` schema simply omits the field — SQLAlchemy never serializes what isn't in the response model | Done since the original port (§0) |
| Silent facial-recognition/biometric use | Explicit, reasoned, audited authorization required; off by default | Done |
| Untraceable privileged actions (who acknowledged this alert, who created this camera) | Audit log on every write + individual-record views | Done |
| Password compromise via a broken hashing library | `bcrypt` used directly (not `passlib`, which was silently mis-hashing under a version mismatch — caught by testing, §12.4) | Done |
| False-positive watchlist alerts from an untuned fuzzy-match threshold | Fuzzy matching built but OFF by default; needs real OCR error-rate data to enable responsibly | Deliberately not done |
| A compromised/weak `SECRET_KEY` in production | `main._refuse_insecure_live_deployment()` fails startup with a clear `RuntimeError` if `APP_MODE=LIVE` and `SECRET_KEY` is still the default — verified by actually booting the server both ways | Done, tested (§12.6) |
| Brute-forcing `/api/auth/login` | `core/rate_limit.py`, per-IP and per-username, wired into `routers/auth.py`. In-process only — a documented limitation once this runs as multiple instances, not a fix that scales past one | Done, tested (§12.6) |
| A leaked JWT being usable until natural expiry (8h default) | `models/user.RevokedToken` + `POST /api/auth/logout`; `get_current_user` checks revocation on every request | Done, tested (§12.6) |
| SQL injection | SQLAlchemy's query builder is used everywhere — audited by grepping all of `server/` for raw `execute()`/`text()`/f-string-built queries; zero hits | Audited, clean (§12.6) |
| A malicious CSV/JSON camera-import payload / stored XSS via free-text fields | `SentinelCameraSource.normalize()` validates every field; `core/sanitize.py`'s `strip_html_tags()` strips markup from every free-text field at the input boundary (camera name/location, watchlist description, investigation title, evidence description, facial-recognition authorization reason) | Done, tested against real payloads (§12.6) |
| Mock government-lookup responses being mistaken for real data | Every response carries `"mock": true` plus an explanatory message | Done |

All five items that were open in this table as of the previous pass are now closed and tested (§12.6). What's still genuinely open in this project overall is §12.7's three items — none of them backend engineering, all of them blocked on external data (real OCR error rates, a real re-identification model, the hackathon's real `/api/ingest` payload) that nobody here can produce by writing more code.

## 8. Testing strategy

[x] **Converted to real pytest** (2026-09-12) — was plain `assert`-and-`print` scripts requiring a manually-started `uvicorn` process; now uses FastAPI's `TestClient` (in-process, no live server needed) against an isolated SQLite file (`tests/conftest.py`, never the dev `DATABASE_URL`). Run with:

```
cd server
.venv\Scripts\python -m pytest -v
```

63 tests, all passing as of 2026-09-13 (§12.7). DB isolation is at the module (test-file) level, not per-function — an autouse fixture wipes operational tables between files (`tests/conftest.py`), closing the real risk (cross-file contamination) without the full per-function `db/database.py` engine/session restructuring a true per-test DB would need. Verified order-independent by running file subsets out of default collection order.

- `tests/test_cameras.py` — CRUD, duplicate rejection, CSV/JSON bulk import, gap-analysis, ingest-sync auth/error-handling, onboarding-source tracking, operator department-scope enforcement.
- `tests/test_adapters.py` — factory resolution across HLS/ONVIF/Vendor SDK, 404 on missing camera, auth requirement.
- `tests/test_ai.py` — orchestrator profile gating, invalid-profile 422.
- `tests/test_watchlists.py` — real DB-backed matching end-to-end including `match_count` incrementing, plus the fuzzy-matching algorithm's correctness and its off-by-default safety property.
- `tests/test_alerts.py` — the severity rubric specifically: anomaly type→severity mapping (including the unmapped-type fallback), and that routine unmatched detections don't become alerts.
- `tests/test_investigations.py` — the full auth → watchlist match → persisted alert → acknowledge → open investigation → timeline → map trace → evidence flow, in one test since each step depends on the last.
- `tests/test_reid_scaffolding.py` — the re-identification interface plumbing (extract → compare) for both `MockReIdentificationProvider` (dimension-only) and the real classical-CV `ColorHistogramReIdentificationProvider` (§12.7) — proves the latter actually uses pixel content, still not real trained appearance matching.
- `tests/test_security_hardening.py` — rate limiting (unit + end-to-end), JWT logout/revocation, the `SECRET_KEY`/`LIVE`-mode startup check, and XSS sanitization against real payloads.

Minimum bar before the hackathon-day live test: the Investigations map-trace flow has an end-to-end test against at least one real ingest-API camera, not only synthetic data — this is the graded functional test, it cannot be mock-only. **`tests/test_investigations.py` proves the shape works end-to-end against synthetic data (real DB writes, real joins, real timestamps) — the literal "against a real ingest-API camera" part is still blocked on organizers publishing a live host** (`INGEST_API_BASE_URL` unset, `core/config.py`); nothing else is missing to run it for real once that exists.

## 9. Scalability posture (design ceiling, not pilot requirement)

Statewide target is ~80,000 cameras. The pilot does not need to run at that scale, but the architecture must show a credible path:

- **Central / regional / edge compute split**: today's single AI orchestrator is the "central" tier; the adapter-factory pattern is already positioned to run per-region without redesign (multiple adapter-factory instances, one registry).
- **Edge-side inference** (see prd.md §13.2) is the concrete lever for bandwidth at scale — detect near the camera, ship events/metadata centrally instead of full video, rather than assuming infinite backhaul bandwidth for 80,000 streams.
- Storage tiers, GPU/accelerator sizing, and phased-rollout-by-district are HLD content (prd.md §14), not code — captured here only as the constraint the adapter/orchestrator split must remain compatible with.
- [ ] Event bus choice for Phase 2+ scale-out: **Redis Streams vs. Kafka — not yet decided.** `server/agents/` is reserved for this; do not build against either until decided (see prd.md §15 decision log).

## 10. Deferred / explicitly out of scope for the pilot

- Model 3-style VMS federation middleware (§1).
- Kafka/Redis Streams event bus (§9) — needed at Phase 2+ scale-out, not pilot scale.
- Real credentialed integration with VAHAN/SARTHI/eGujCop/AFIS/NAFIS (§7) — mock adapters exist (§7), real access does not and is explicitly out of scope.
- Facial recognition / biometric ID unless explicitly authorized (§7) — the gate/toggle enforcing this is built; the capability itself (an actual face-recognition model) was never in scope regardless.
- Fuzzy (Levenshtein/Jaro-Winkler) watchlist matching (§5 Pipeline 5, `intelligence/watchlist_matcher.py`) — needs real OCR error-rate data to set a defensible threshold, not a guessed cutoff.
- Appearance-based re-identification for cross-camera correlation beyond exact plate match (§5 Pipeline 5, `intelligence/entity_graph.py`) — ai_pipelines.md §5 differentiator, not built.
- Per-test database isolation in the pytest suite (§8) — session-scoped DB is good enough for now.

## 11. Local backend setup

```
cd server
python -m venv .venv && .venv\Scripts\activate      # or source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt                       # pinned, ported from contrib/aneesh/backend
cp ../.env.example ../.env                             # DATABASE_URL, HLS_OUTPUT_DIR
uvicorn main:app --reload --port 8000
```

`requirements.txt` is now pinned (ported from `contrib/aneesh/backend/requirements.txt`; `requests`, `bcrypt`, `pyjwt`, `pytest`, `httpx` added during later passes — see the file's comments for why `bcrypt` is used directly rather than via `passlib`). Default `DATABASE_URL` is SQLite (`sqlite:///./gvista.db`); switch to a Postgres+PostGIS URL and run `migrations/001_postgis_setup.sql` once ready (§4). `ffmpeg`/`ffprobe` must be separately installed and on `PATH` for `video/ffmpeg_runner.py` (real RTSP→HLS transcoding) and `routers/health.py`'s `ffmpeg_available` check — not a pip dependency.

On first startup, a bootstrap `ADMIN` account is created automatically (username/password from `ADMIN_BOOTSTRAP_USERNAME`/`ADMIN_BOOTSTRAP_PASSWORD`, defaulting to `admin`/`changeme123` — change these before any real use, §7). Run `pytest` per §8 to verify the install.

## 12. Backend feature checklist

Full status as of the `contrib/aneesh/` port, 2026-09-12. **Done** = ported and present in `server/` (verify against §12.1 before trusting further). **Fix needed** = real code exists but has a known correctness gap. **Not built** = still an empty stub, no shortcuts taken.

### 12.1 Verification (done 2026-09-12 — a port is unverified until it runs)

- [x] `pip install -r requirements.txt` completes cleanly on Python 3.13 (had to relax exact pins to `>=` minimums first — see the comment at the top of `requirements.txt`; the originally-pinned `pydantic==2.6.3` has no prebuilt `pydantic-core` wheel for cp313 and fails a from-source Rust build without a working MSVC link step)
- [x] `uvicorn main:app` boots without error and creates `gvista.db`
- [x] `tests/test_cameras.py`, `tests/test_adapters.py`, `tests/test_ai.py` all pass against the running server
- [x] `GET /` and `GET /api/health/` respond as expected

### 12.2 Done (ported, working)

- [x] Camera registry: model, schema, idempotent upsert, manual/CSV/JSON onboarding (§5 Pipeline 1) — `models/camera.py`, `schemas/camera.py`, `services/camera_service.py`, `routers/cameras.py`
- [x] Adapter factory + RTSP/HLS real implementations (§3) — `adapters/factory.py`, `rtsp.py`, `hls.py`
- [x] ONVIF + Vendor SDK adapters, honestly `UNSUPPORTED` rather than faked (§3) — `adapters/onvif.py`, `vendor.py`
- [x] AI orchestrator: profile gating, quality analysis, two-stage plate detection, never-hallucinate OCR contract (ai_pipelines.md §1/§2) — `ai/orchestrator.py`, `quality.py`, `mock_providers.py`
- [x] Local RTSP→HLS transcoding with TCP transport + reconnect/backoff (§2 checklist items 1 & 3, for this path) — `video/ffmpeg_runner.py`, `stream_manager.py`
- [x] Live AI-event SSE stream, real orchestrator wired in (rewritten during port, §0) — `routers/streams.py`, `intelligence/events.py`, `alert_engine.py`
- [x] Adapter health diagnostic endpoint, credentials never exposed — `routers/adapters.py`
- [x] Integration test suite ported and adapted — `tests/test_cameras.py`, `test_adapters.py`, `test_ai.py`
- [x] `requirements.txt` pinned

### 12.3 Fixed (2026-09-12, verified against the running server + tests)

- [x] `adapters/rtsp.py` — TCP transport now forced via `OPENCV_FFMPEG_CAPTURE_OPTIONS` (set once at module import). OpenCV's default is UDP; this closes the gap for the OpenCV capture path (the FFmpeg/`stream_manager` path was already TCP).
- [x] `adapters/rtsp.py`/`hls.py` — both now self-reconnect with capped exponential backoff (`MAX_RECONNECT_ATTEMPTS=3`, mirrors `video/stream_manager.py`'s pattern) on connect *and* read failure, instead of just reporting `DEGRADED`/`OFFLINE` and waiting for external polling to restart them.
- [x] Frame timestamps now prefer the stream's own reported position (`CAP_PROP_POS_MSEC`, anchored to connect-time wall clock) over pure `datetime.now()` per read — **caveat, still honest**: unverified against a real feed, since none exists to test against yet; live RTSP backends commonly report 0/unsupported for this property, in which case it silently falls back to local time exactly as before. See `adapters/rtsp.py`'s `_resolve_timestamp()` docstring.
- [x] `intelligence/alert_engine.py` — real DB-backed watchlist matching. Built `models/watchlist.py` (`WatchlistEntry` + `WatchlistMatch`, match count derived from match rows rather than a stored counter), `schemas/watchlist.py`, `services/watchlist_service.py`, `intelligence/watchlist_matcher.py` (exact match only — see that file's docstring for why fuzzy matching isn't implemented yet), and `routers/watchlists.py` (list + create, wired into `main.py`). Verified end-to-end in `tests/test_watchlists.py`: a matching plate produces a real watchlist alert with the entry's actual risk level/category, a non-matching plate produces a plain event, and `match_count` genuinely increments. Caught and fixed a real bug in the process — `_create_watchlist_alert` was reading ORM attributes after the session that fetched them had committed and closed (`DetachedInstanceError`); fixed by snapshotting the needed fields before the commit.
- [x] `routers/streams.py`'s AI pipeline now reads `Camera.ai_profile` per camera (new column, defaults to `TRAFFIC`, backs frontend.md §3.8's per-camera profile selector) instead of hardcoding `TRAFFIC` for every camera. Falls back to `TRAFFIC` with a logged warning if a camera somehow has an invalid value.
- [x] Pydantic v1-style patterns audited across all of `server/` (`@validator`, `.dict()`, `.json()` on a model, `orm_mode`, `class Config:`, `@root_validator`) — nothing found beyond the one already-fixed `schemas/camera.py` validator.

### 12.4 Built (2026-09-12, second pass — verified against pytest + manual endpoint checks)

Every item that was in this section as "not built" is now built, with one deliberate exception (fuzzy watchlist matching — see below). Detail on each lives in the section noted; this is the roll-up.

- [x] `models/`/`schemas/` for `alert.py`, `event.py`, `investigation.py`, `user.py`, `admin_settings.py` (§4)
- [x] `routers/auth.py`, `alerts.py`, `investigations.py`, `admin.py` (new, not in the original stub list) — all wired into `main.py` (§6)
- [x] Alert persistence + severity scoring rubric (§5 Pipeline 5)
- [x] Case-file CRUD + evidence attachment for Investigations, plus derived Timeline/Map-trace (§5 Pipeline 5)
- [x] `intelligence/entity_graph.py` — exact-identifier cross-camera correlation (§5 Pipeline 5; fuzzy/appearance-based correlation deliberately deferred, §10)
- [x] `/api/ingest` catalogue-sync job (§5 Pipeline 1) — untested against the real endpoint, organizers haven't published a host yet
- [x] PostGIS migration written (§4) — untested against a real Postgres instance, none available here
- [x] Gap-analysis query (§5 Pipeline 1)
- [x] RBAC + audit log (§7)
- [x] Facial-recognition authorization gate + toggle (§7)
- [x] Mock VAHAN/SARTHI/eGujCop/AFIS/NAFIS adapters (§7)
- [x] `video/frame_sampler.py`, wired into `routers/streams.py` (§5 Pipeline 2)
- [x] Converted `tests/*.py` to real pytest — 28 tests passing at the time (48 as of §12.6, §8)
- [x] End-to-end vehicle-trace test — done against synthetic data (`tests/test_investigations.py`); the "real ingest-API camera" part is blocked on external access, not on anything left to build here (§8)

Two real bugs were caught and fixed while building this, both from writing an actual test rather than trusting the code: a `passlib`/modern-`bcrypt` incompatibility that broke password hashing entirely (switched to `bcrypt` directly, see `requirements.txt`'s comment), and a `DetachedInstanceError` from reading ORM attributes after the session that fetched them had committed and closed (`intelligence/alert_engine.py` — fixed by snapshotting needed fields before the commit, same fix as the earlier §12.3 watchlist bug, so this pattern is now worth watching for elsewhere).

### 12.5 Closed (2026-09-13 — verified against 37 passing pytest tests)

Every item from this section's previous pass is now closed, two of them as deliberate, honest partial-completions rather than the full (currently unbuildable) thing:

- [x] **Fuzzy watchlist matching** — the algorithm (`intelligence/watchlist_matcher.py`'s `levenshtein_distance` + `_match_fuzzy`) is real and unit-tested, but wired **off by default** (`ENABLE_FUZZY_WATCHLIST_MATCHING`) since an untuned distance threshold still risks false-positive alerts — the capability is complete, the threshold-tuning decision correctly isn't.
- [x] **Appearance-based re-identification scaffolding** — `ai/interfaces.py`'s `ReIdentificationProvider` + `ai/mock_providers.py`'s `MockReIdentificationProvider`, matching every other detector's mock/real swap pattern (ai/README.md). Tested that the plumbing works (`tests/test_reid_scaffolding.py`); **not** wired into `intelligence/entity_graph.py`'s real trace logic, and the mock carries zero real appearance information by design — see the interface's docstring for why faking this into the graded live-test path would be dishonest.
- [x] **Auth enforced on every route** that reads or writes registry/watchlist/alert/investigation/adapter/stream data — closed across `routers/cameras.py`, `watchlists.py`, `alerts.py`, `investigations.py`, `adapters.py`, `streams.py`. Only true liveness/diagnostic endpoints (`GET /`, `/api/health/`, `/api/ai/*`) stay open. **Correction, §12.8**: this claim was wrong for three routes -- two in `routers/streams.py` (`GET /{camera_id}/status`, `GET /events/stream`) and `routers/admin.py`'s `GET /api/admin/facial-recognition` -- all still genuinely unauthenticated. Found by a real re-check of this exact line, not by re-reading the code and taking the checkbox's word for it. Fixed; see §12.8.
- [x] **Role-based search actually enforced**, not just modeled — `department_scope` now filters `GET /api/cameras/*` server-side (§7).
- [x] **Audit log on individual-record views** (`ALERT_VIEWED`, `INVESTIGATION_VIEWED`), deliberately not on list endpoints — see §7's reasoning.
- [x] **ER diagram** — drawn (§4, Mermaid).
- [x] **Onboarding source** — real stored column (`Camera.onboarding_source`), tested per onboarding path (§4).
- [x] **Per-test database isolation** — not the full per-function rewrite (still not worth the `db/database.py` restructuring it would need), but a real fix for the actual risk: an autouse, module-scoped fixture wipes every operational table between test *files*, eliminating cross-file contamination. Verified by running a subset of files in a different order than pytest's default collection order (`tests/conftest.py`).
- [x] **Single consolidated threat model** — §7.1, table format, including the three items it surfaced as genuinely still open (see below).

### 12.6 Closed (2026-09-13 — verified against 48 passing pytest tests)

Five of the eight items from this section's previous pass are now closed, real and tested. The other three stay open on purpose — they're blocked on external data/models nobody here has, and forcing a fix would mean guessing, which is exactly what got avoided everywhere else in this project.

- [x] **Rate limiting on `/api/auth/login`** — `core/rate_limit.py`'s `InMemoryRateLimiter`, two instances (per-IP and per-username, either tripping blocks the attempt), wired into `routers/auth.py`. Explicitly in-process, not Redis-backed — documented limitation, not an oversight, since Redis is already deferred to Phase 2+ (§9). A successful login resets both limiters for that identity. Tested end-to-end (`tests/test_security_hardening.py`) *and* as a unit test of the limiter class itself, specifically so the HTTP-level test can't leak rate-limit state into other tests sharing the same in-process limiter — caught this for real: an earlier version of the logout test below did leak shared session state and broke five other tests, fixed by using a dedicated token instead of the shared one.
- [x] **JWT revocation/blocklist** — `models/user.RevokedToken` (keyed by the token's `jti` claim, now issued on every token), `core/security.revoke_token()`/`is_token_revoked()`, `POST /api/auth/logout`. `get_current_user` checks revocation on every request. Tested that a revoked token is rejected immediately, not just eventually expires.
- [x] **Startup check for a default `SECRET_KEY` in `LIVE`** — `main._refuse_insecure_live_deployment()`, called first thing in the lifespan. **Verified for real, not just unit-tested**: booted the actual server with `APP_MODE=LIVE` and the default key and watched it refuse to start with a clear `RuntimeError`; booted it again with a real key and confirmed it comes up fine. `DEMO` mode (this backend's actual current deployment mode) is unaffected either way.
- [x] **SQL-injection audit** — actually audited, not just asserted safe: grepped all of `server/` for raw `execute()`/`text()`/f-string-built queries/`.filter(f"...")`. Zero hits — every query goes through SQLAlchemy's parameterized query builder. Downgraded from "believed safe" to "audited, clean."
- [x] **Free-text XSS sanitization** — `core/sanitize.py`'s `strip_html_tags()` (strips markup at the input boundary rather than HTML-escaping it — see that module's docstring for why storing escaped entities in a JSON API would be actively wrong), applied via Pydantic `field_validator`s on `Camera` (name/location/department/district/vms_vendor), `WatchlistEntry` (identifier/description/source/added_by), `Investigation`/`Evidence` (title/entity/assigned_officer/description), and the facial-recognition authorization `reason`. Tested against real `<script>`/`<img onerror>`/`<svg onload>` payloads through the actual create endpoints.

### 12.7 Remaining known gaps — tooling built, the actual blockers unchanged (2026-09-13, 63 passing pytest tests)

These three items are still genuinely open — none of them can be closed by writing more code, because each is blocked on external data/infrastructure this environment doesn't have. What changed in this pass is real, tested tooling that makes each one *cheap to finish correctly* the moment the blocker lifts, instead of code that pretends it's already finished:

- [ ] **`/api/ingest` field-mapping** (`integration/ingest_sync.py`) — still can't be verified against the real endpoint (organizers haven't published a host). Added two real things instead of guessing harder: `preview_ingest_catalogue()` / `GET /api/cameras/ingest-preview` (admin-only) fetches the real catalogue AS-IS — no normalization, no DB writes — so the *first* thing anyone does once a host exists is look at real field names, not trust a guess with writes. And `INGEST_FIELD_ALIASES` (`core/config.py`, a JSON env var) turns a field-name rename in the real payload into a config change (set the var, restart) rather than a code change. Tested (`tests/test_cameras.py`): the preview endpoint requires admin auth and fails clearly (400, not a silent no-op) when unconfigured — same honesty contract as `sync-ingest`; alias mapping is unit-tested directly, including that an alias never clobbers a field the payload already names correctly.
- [ ] **Fuzzy watchlist matching's distance threshold** — still needs real OCR error-rate data (ai_pipelines.md §6/§7); still off by default. Added `calibrate_threshold()` (`intelligence/watchlist_matcher.py`): given real labeled `(ocr_reading, ground_truth, is_same_plate)` triples, it computes precision/recall at every candidate threshold and recommends the largest one that still meets a minimum precision bar — so the day real OCR data exists, setting `FUZZY_WATCHLIST_MAX_DISTANCE` is a defensible calculation, not another guess. Tested against hand-constructed synthetic examples with a known right answer (`tests/test_watchlists.py::test_threshold_calibration_tool_on_synthetic_data`) — this proves the tool's math is correct, and deliberately does **not** claim to derive a real threshold from synthetic data.
- [ ] **Real appearance-based re-identification model** — still needs real training data/a real model; `MockReIdentificationProvider` still carries zero appearance information. Added `ai/classical_reid_provider.py`'s `ColorHistogramReIdentificationProvider` — a real, non-fabricated classical CV baseline (HSV color histograms via OpenCV's `cv2.compareHist`, a well-established pre-deep-learning technique) that actually looks at pixel content instead of just crop dimensions. **Not** a substitute for a trained re-id model (color histograms are blind to shape/texture and fooled by lighting — two different white sedans will often score "similar") and **not** wired into `intelligence/entity_graph.py`'s real trace logic, for the same reason the mock isn't: nobody has evaluated it for real accuracy on this project's actual footage, so gating an investigation match on it would be irresponsible. Tested (`tests/test_reid_scaffolding.py`) that it genuinely uses pixel data — same-size crops of different colors score measurably lower similarity than identical crops, something the dimension-only mock structurally cannot do — and that it correctly treats two contentless (all-zero) histograms as "no signal" rather than a false "perfect match" (a real edge-case bug caught by testing: OpenCV's correlation formula returns 1.0 for two constant/flat inputs by mathematical convention, which is backwards for this use).

None of this changes the underlying honesty posture: an unpublished government API, unlabeled OCR error data, and an untrained re-id model are still not things a backend engineer can produce by writing more Python. What's different is that when each one becomes available, closing the gap is now "run the calibration tool" / "point the preview endpoint at the real host and read the field names" / "swap in a trained model behind the existing interface" — not a rewrite.

### 12.7.1 A real ingest host surfaced (2026-09-13) — wired up, unverified from this sandbox

A live hackathon test rig at `cctv.corp8.cloud` (RTSP/WHEP direct on `103.250.160.189`) turned up, with a documented integration contract different in shape from the official-portal `/api/ingest` contract §2 assumed: the catalogue is a flat `GET https://cctv.corp8.cloud/cameras.json`, not a path under a configurable base, and RTSP/WHEP authenticate per-connection via a registered email+password embedded in the URL (`rtsp://email:password@host:8554/stream/<id>`) rather than a per-camera credential the catalogue itself would need to hand back (it almost certainly can't, without leaking working credentials to every caller of a public JSON endpoint).

What actually got built, real and tested:

- [x] `INGEST_CATALOGUE_URL` (`core/config.py`) — when set, used as-is and takes priority over `INGEST_API_BASE_URL`/`api/ingest`, so both real shapes are honestly supported instead of one silently overwriting the other's assumption.
- [x] `_build_authenticated_rtsp_url()` (`integration/ingest_sync.py`) — synthesizes the credentialed per-camera RTSP URL from `INGEST_STREAM_EMAIL`/`INGEST_STREAM_PASSWORD`/`INGEST_RTSP_HOST`/`INGEST_RTSP_PORT`, percent-encoding both email and password (`urllib.parse.quote(..., safe="")`) so a `@`, `:`, or `/` inside either can't be mistaken for URL structure — matches the real doc's own example of percent-encoding `@` in the email. Returns `None`, not a guess, when unconfigured.
- [x] `_map_ingest_fields()` now calls this to fill `rtsp_url` only when the catalogue didn't already provide one, never overriding a real value.
- [x] Real credentials for this rig now live in the local, gitignored `.env` only — never in `.env.example` (placeholders only) or any committed file. Verified `.env` is covered by `.gitignore` before writing anything into it.
- [x] Tested (`tests/test_cameras.py`, 6 new tests, no network call): `INGEST_CATALOGUE_URL` priority, the clear-failure message when neither URL is configured, correct percent-encoding and exactly one unescaped `@` in the synthesized URL (a real edge case — an unencoded `@` inside the credentials would silently misparse the URL at the wrong split point), the `None`-when-unconfigured case, and that `_map_ingest_fields` never overwrites a catalogue-provided `rtsp_url`.

**What's still genuinely unverified, and why**: this sandbox's own safety layer blocks outbound requests to this host once real credentials are in play (classified as "exfil scouting" — a reasonable default given a real password was in the conversation). So the actual `GET /cameras.json` response shape, and a real RTSP connection through `adapters/rtsp.py`, have not been observed from inside this environment. `preview_ingest_catalogue()` / `GET /api/cameras/ingest-preview` (§12.7 above) is exactly the tool for someone running this from an unrestricted network to use first — inspect the real field names before trusting `sync-ingest` with writes. This is the same honesty boundary as everywhere else in this section: the code is real and tested against everything that doesn't require reaching an external host from here; the last mile needs a run from a machine that can actually reach it.

### 12.8 Corrected a stale "auth on every route" claim (fifth pass, 2026-09-14)

Asked to check every checklist item in this doc against reality, not just re-read it. Most items held up — every referenced file exists (verified with a real filesystem check, not a guess), the raw-SQL audit still turns up zero hits, the 63-passing-test count in §12.7's header matches `pytest --collect-only` exactly, and rate limiting/JWT revocation/the `SECRET_KEY` startup guard/XSS sanitization all still work as described.

**§12.5's "Auth enforced on every route ... only `GET /`, `/api/health/`, `/api/ai/*` stay open" claim was wrong**, in two places. Found by actually enumerating every route FastAPI had registered (`app.routes`) and curling each one unauthenticated against the running server, not by re-reading the code and trusting the checkbox:

- Two `routers/streams.py` routes had no auth dependency at all: `GET /{camera_id}/status` and `GET /events/stream` (the live AI-event SSE feed — real detection events including plates/entities/camera locations, broadcast to whoever connects).
- `GET /api/admin/facial-recognition` (`routers/admin.py`) also had none, while its own sibling route (`POST .../authorize`) correctly required `require_admin` — it leaked whether facial recognition is currently enabled and its full authorization history (who, when, why) to anyone, unauthenticated. This also contradicted docs/frontend.md's own claim that all three Administration tabs are admin-only on the backend.

Fixed, not just flagged:
- [x] `GET /{camera_id}/status` now requires `get_current_user` like every other camera/stream route.
- [x] `GET /events/stream` now requires auth too, but via a new `get_current_user_header_or_query` (`core/security.py`) rather than the standard header-only `get_current_user` — the browser's native `EventSource` API (what `client/src/api/client.js`'s `subscribeToLiveEvents()` uses) cannot set an `Authorization` header at all, so a header-only requirement would make the endpoint real-auth-protected but unreachable from the actual frontend. The new dependency accepts the same JWT either via the header or a `?token=` query param — same validation (signature, expiry, revocation check), same `get_current_user` everywhere else in the codebase; this one route is the sole, narrowly-scoped exception, with the tradeoff (query params can end up in server access logs) documented in its own docstring.
- [x] `GET /api/admin/facial-recognition` now requires `require_admin`, matching its sibling authorize route and every other `/api/admin/*` endpoint.
- [x] `client/src/api/client.js` updated to match: `getStreamStatus()` now sends the real auth header (was previously calling this expecting it to be open — its own comment said so, which was itself downstream of the same stale assumption); `subscribeToLiveEvents()` now appends `?token=` to the `EventSource` URL. `getFacialRecognitionStatus()` needed no change — it already sent auth headers, just against a route that hadn't been checking them.
- [x] Four regression tests added (`tests/test_security_hardening.py`) — none of these three routes were covered by any existing test before, which is exactly how this went unnoticed. The SSE route's own naive test (open the stream, assert 200) hung indefinitely inside the endpoint's `await queue.get()`, since the connection is meant to stay open forever — replaced with a direct unit test of `get_current_user_header_or_query` instead of driving the actual infinite connection through a test client.

Verified end-to-end, not just unit-tested: restarted the real server, re-swept every registered route unauthenticated (each now returns exactly `401` or the documented open-endpoint `200`, no third case found), curled the fixed endpoints with a real bootstrap-admin JWT via both header and query param (`200`), then drove a real Playwright browser through an actual login and confirmed the real `EventSource` request the frontend sends carries the token in the URL and connects, and that the Administration page's Facial Recognition tab still renders. 68/68 pytest tests pass (63 existing + 5 new — 4 for this fix, one more from `test_facial_recognition_status_requires_admin` covering both the 401 and 200 case in one test).
