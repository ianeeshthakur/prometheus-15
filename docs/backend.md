# G-VISTA — Backend

Governs backend architecture, the camera/adapter/database layer, APIs, security posture, and testing. Product scope lives in [prd.md](prd.md); AI detector contracts and the analytics/intelligence pipelines live in [ai_pipelines.md](ai_pipelines.md) — this file stops at "detections arrive as a `NormalizedFrame`/event" and hands off there.

Stack: **FastAPI + SQLAlchemy**, SQLite for local dev → **PostgreSQL + PostGIS** for anything spatial (Model 1 registry, gap-analysis).

**Ported from `contrib/aneesh/backend/` on 2026-09-12** (see `docs/prd.md` §15 decision log). That folder held a real, working FastAPI backend (~2,100 lines) from the pre-rebuild `prometheus-1` migration; the adapters, AI orchestrator, camera registry, video streaming, and tests below are now live in `backend/` itself, not just archived reference. Three things were fixed, not copied verbatim, during the port:

1. **The legacy in-memory `camera_registry` module was dropped**, not ported — it simulated one hardcoded demo camera from env vars, which duplicates and conflicts with the DB-backed Model 1 registry as single source of truth. The real replacement (an `/api/ingest` catalogue-sync service, §2) is still unbuilt — see §12.
2. **`routers/streams.py` was genuinely broken in the source** — it imported `from ai.detection_service import detection_service, ocr_service`, a module that was never committed anywhere in the migration, so the file would have raised `ImportError` on startup. The ported version wires the real `AIOrchestrator` (`ai/orchestrator.py`) instead.
3. **Flat `models.py`/`schemas.py`/`db.py` were split** into the `models/`, `schemas/`, `db/` packages this doc already specified, so only `camera.py` in each package is populated — the rest (`alert.py`, `event.py`, `investigation.py`, `watchlist.py`, `user.py`) remain the pre-existing empty stubs, since contrib had no equivalent to port.

Full before/after detail in `docs/prd.md` §15.

---

## 1. Integration model decision

The hackathon defines four reference integration models and explicitly allows — and rewards — hybrids. This project is:

**Model 1 (mandatory) + Model 2 (core) + Model 4 elements (analytics layer).**

- **Model 1 — Centralised CCTV Registry & GIS Foundation** (compulsory for every submission): a DB-backed camera registry (`backend/models/camera.py`, `backend/services/camera_service.py`) is the single source of truth for every camera regardless of which department or protocol owns it. It is metadata/registry-only — it does not itself stream video — and is paired below with Model 2 for the actual video path.
- **Model 2 — Unified Viewing & Selective Analytics** (direct integration, no middleware/federation layer): `backend/adapters/` (`rtsp.py`, `hls.py`, `onvif.py`, `vendor.py`, behind `factory.py`) talk directly to each department's cameras/VMS per-protocol. This matches Model 2's explicit "no intermediate middleware" requirement.
- **Model 4 elements — Central AI Platform**: the AI orchestrator and intelligence layer (`backend/ai/orchestrator.py`, `backend/intelligence/`) form a centralized analytics layer sitting behind the direct (Model 2) integrations, so detections from every department flow into one alerting/investigation surface — the part of Model 4 worth keeping without adopting its "one consolidated VMS" storage/recording mandate, which is out of scope for a hackathon pilot.

Model 3 (VMS federation/middleware) is deliberately not adopted — it would duplicate what the adapter factory already does and contradicts Model 2's "no middleware" requirement, which is the model we're pairing with Model 1.

## 2. The real ingest API (hackathon simulated dataset)

Verified live at hackathon-provided infrastructure (prd.md §0.1). This is the actual integration target for `backend/adapters/rtsp.py` and `backend/adapters/hls.py` — not a hypothetical protocol to design against later.

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

## 3. Adapter contracts (`backend/adapters/`)

Every adapter normalizes its protocol into the same `NormalizedFrame` shape so the AI orchestrator (ai_pipelines.md §1) never needs to know which protocol produced a frame.

- **RTSP** (`rtsp.py`, real, ported+fixed) — headless OpenCV capture, credential handling (URL kept instance-private, never returned), TCP-forced, self-reconnect-with-backoff, stream-relative timestamps (§12.3). Primary adapter against the real ingest API (§2).
- **HLS** (`hls.py`, real, ported+fixed) — `.m3u8` ingestion into the same `NormalizedFrame` shape as RTSP, same reconnect/timestamp fixes as RTSP (§12.3); used for the dashboard/mobile/restricted-network path.
- **ONVIF** (`onvif.py`, ported) — explicitly returns `UNSUPPORTED`, not faked. [ ] Profile S discovery/media negotiation — not yet built; no authorized ONVIF test hardware available.
- **Vendor SDK** (`vendor.py`, ported) — explicitly returns `UNSUPPORTED`, not faked. [ ] ctypes wrapper strategy — [ ] decide which vendor to implement first once real vendor VMS access is available.
- **Factory** (`factory.py`, real, ported+adapted) — resolves the adapter by DB-registry lookup only (legacy in-memory fallback dropped, see §0).
- **Discovery/normalization** (`integration/discovery_adapter.py`, real, ported) — `SentinelCameraSource.normalize()` maps arbitrary catalogue JSON/CSV rows into `CameraCreate`, with per-field validation errors (used by the bulk CSV/JSON importers in `routers/cameras.py`). [ ] True network-scan/WS-Discovery auto-onboarding is a separate, still-unbuilt capability despite the module name (kept for continuity with the original migration).

## 4. Data layer

- Postgres, extended with **PostGIS**, is the target for anything spatial (Model 1's GIS registry, the coverage gap-analysis report, department/district spatial queries; suggested by the hackathon's own stack list). SQLite (current `.env.example` default) stays the local-dev default.
- [x] **Migration written**: `backend/migrations/001_postgis_setup.sql` — enables the extension, adds a `geom geometry(Point, 4326)` column alongside the existing lat/lng floats, backfills it, adds a GIST index, and a trigger to keep it in sync on insert/update. **Unverified against a real Postgres instance** — none is available in this dev environment; review/dry-run before applying anywhere that matters. Doesn't touch the SQLite path at all — `models/camera.py` keeps plain float columns regardless of which DB is configured.
- All 6 registry-adjacent models are now real: `camera.py` (department, district, protocol, vendor, geolocation, status, `ai_enabled`, `ai_profile`), `watchlist.py` (`WatchlistEntry` + `WatchlistMatch`), `user.py` (`User` + `AuditLogEntry`), `event.py` (`CameraEvent`), `alert.py` (`Alert`), `investigation.py` (`Investigation` + `InvestigationEvidence`), `admin_settings.py` (`FacialRecognitionAuthorization`) — each backed by a `schemas/*.py` Pydantic pair. Built during the §12.4 build-out (2026-09-12), designed against `lib/types.ts`'s frontend shapes where one already existed (`Alert`, `CameraEvent`), and against `docs/frontend.md`'s textual spec where it didn't (`Investigation` — that page was still a placeholder when this was written).
- Onboarding source (bulk/manual/API) is still not a stored column on `Camera` — inferred only by which endpoint was called, not persisted per-row.
- [ ] **ER diagram** — still not drawn; 7 models now have real schemas, this is overdue but hasn't blocked anything yet.

## 5. Pipelines owned by the backend

(Pipelines 3 and 4 — AI video analytics and intelligence correlation — are AI-domain and live in ai_pipelines.md.)

### Pipeline 1 — Camera registry
Camera onboarding via manual entry, CSV/JSON bulk import, and the `/api/ingest` catalogue (§2) — all three paths required by Model 1. `camera_uid` is the deterministic key; upserts must be idempotent (re-importing the same catalogue must not create duplicates).
- [x] Manual (`POST /api/cameras/`), CSV (`POST /api/cameras/import/csv`), and JSON (`POST /api/cameras/import/json`) onboarding all implemented and tested (`tests/test_cameras.py`).
- [x] Idempotent upsert by `camera_uid` — `services/camera_service.upsert_camera()`, with a race-condition retry on `IntegrityError`.
- [x] `/api/ingest` catalogue sync — `integration/ingest_sync.py` + `POST /api/cameras/sync-ingest` (admin-only). **Unverified against the real endpoint**: `INGEST_API_BASE_URL` is unset until organizers publish a live host; calling the endpoint unconfigured returns a clear 400, not a silent no-op (tested). The field-mapping guesses at the undocumented parts of the payload shape (department/vms_vendor aren't in the documented fields) — expect to adjust once a real payload can be inspected.
- [x] Gap-analysis query — `services/camera_service.get_gap_analysis()` + `GET /api/cameras/gap-analysis`, real coverage-shortfall report by district × department (docs/frontend.md §3.1 Row 4 / §3.7), tested.

### Pipeline 2 — Protocol normalization
The adapter factory (`backend/adapters/factory.py`) selects RTSP/HLS/ONVIF/Vendor-SDK per camera and normalizes output into `NormalizedFrame` before handing off to the AI orchestrator.
- [x] Factory dispatch logic + `NormalizedFrame` schema — implemented; RTSP/HLS paths real, ONVIF/Vendor explicitly `UNSUPPORTED` per §3.
- [x] Frame-rate pacing — `video/frame_sampler.py`'s `FrameSampler` wraps an adapter and caps reads at `AI_TARGET_FPS`, replacing the inline `asyncio.sleep()` `routers/streams.py` used to do this with.

### Pipeline 5 — Alerts & investigation
Alert severity scoring, delivery, and investigation case-file CRUD backing frontend.md §3.3/§3.5 — **all built** during the 2026-09-12 §12.4 pass, verified end-to-end in `tests/test_investigations.py` and `tests/test_alerts.py`.
- [x] Live event delivery — `routers/streams.py`'s `/api/streams/events/stream` SSE endpoint + `intelligence/alert_engine.py` pub/sub, wired to the real `AIOrchestrator` output.
- [x] Watchlist matching — real DB lookup via `intelligence/watchlist_matcher.py`, exact match only (fuzzy matching deliberately deferred, see that file's docstring).
- [x] **Severity scoring rubric** (`services/alert_service.py`): WATCHLIST_MATCH uses the matched entry's real `risk_level`; ANOMALY uses a type→severity map (`WRONG_WAY`→CRITICAL, `UNATTENDED_OBJECT`→HIGH, `CROWD`/`LOITERING`→MEDIUM, unmapped types→MEDIUM default — `anomaly_type` stays an open string per ai_pipelines.md §2, so this never errors on an unrecognized type); routine unmatched plate/person detections deliberately do **not** become alerts (7 C's "Courteous" — don't cry wolf), just a persisted `CameraEvent`.
- [x] **Alert persistence** — `models/alert.py` + `services/alert_service.py`; every watchlist match and anomaly now creates a real, queryable `Alert` row (`GET/PATCH /api/alerts/*`), not just an SSE broadcast. Every event (matched or not) is separately persisted as a `CameraEvent` (`services/event_service.py`) — this is what closed the original "events broadcast live but never written to a DB table" gap.
- [x] **Case-file CRUD + evidence** — `models/investigation.py` (`Investigation` + `InvestigationEvidence`), `services/investigation_service.py`, `routers/investigations.py`: create/list/status, evidence attach/list, `POST /api/alerts/{alert_uid}/investigation` to open a case directly from an alert (auto-sets priority from severity). Timeline and Map Trace (frontend.md §3.5) are *derived*, not separate tables — queried from `CameraEvent`/`Alert` rows matching the case's `entity`, via `intelligence/entity_graph.py`'s `trace_entity()`. That trace function is exact-identifier correlation (today: normalized plate), not graph-theoretic re-identification — appearance-based re-id (ai_pipelines.md §5 differentiator) isn't built, so that's honestly as far as "cross-camera correlation" goes right now. It's still the real shape of the hackathon's graded live vehicle-tracking test (docs/prd.md §0.1); verified end-to-end against synthetic data in `tests/test_investigations.py` since no real ingest-API camera exists to test against yet.

## 6. API surface (`backend/routers/`)

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
- [x] **Auth + RBAC** — `core/security.py` (JWT via `pyjwt`, password hashing via `bcrypt` directly — not `passlib`, see requirements.txt's comment for why), `models/user.py` (`User`: `ADMIN` sees every department, `OPERATOR` is scoped to one via `department_scope`, feeding frontend.md §3.7's "role-based search"), `routers/auth.py`. A first `ADMIN` account is bootstrapped automatically on a fresh DB from `ADMIN_BOOTSTRAP_USERNAME`/`ADMIN_BOOTSTRAP_PASSWORD` (loud, obvious defaults — override before any real use) since there's otherwise no way to log in at all. Not yet wired into every route that arguably needs it (e.g. `GET /api/cameras/` has no auth requirement today) — only the routes where a write or a privileged read made it an obvious first cut.
- [x] **Audit log** — `models/user.AuditLogEntry` + `core/security.log_action()`, `GET /api/admin/audit-log`. Wired into: login, user creation, alert status changes, investigation creation/status/evidence, camera→investigation linking, ingest sync, facial-recognition authorization. **Not** wired into every alert *view* yet (frontend.md §3.8 literally says "every alert view" — that's a lot of log volume for a read; revisit if that's really the intent or if "view" meant "action taken while viewing").
- [x] **Facial recognition / biometric identification** — gated behind an explicit authorization workflow, never a default (`is_currently_enabled()` returns `False` when no authorization row exists at all). `models/admin_settings.FacialRecognitionAuthorization`: each row is one authorization *event* (grant or revoke) with a required `reason` and `authorized_by`, not a single mutable flag — the table itself is the audit trail. `GET/POST /api/admin/facial-recognition*`, admin-only to authorize. Grounded in India's DPDP Act, 2023 and the Puttaswamy privacy judgment.
- [x] **Mock government database lookups** — `integration/mock_gov_adapters.py` (VAHAN, SARTHI, eGujCop, AFIS, NAFIS), `GET /api/admin/gov-lookup/*`. Every response carries `"mock": true` and an explanatory message; no real credentialed access exists or is attempted.
- [ ] Single consolidated threat model / security posture doc — not yet written; this section is still the seed of it, now with more to consolidate.

## 8. Testing strategy

[x] **Converted to real pytest** (2026-09-12) — was plain `assert`-and-`print` scripts requiring a manually-started `uvicorn` process; now uses FastAPI's `TestClient` (in-process, no live server needed) against an isolated SQLite file (`tests/conftest.py`, never the dev `DATABASE_URL`). Run with:

```
cd backend
.venv\Scripts\python -m pytest -v
```

28 tests, all passing as of 2026-09-12. One known limitation: the DB fixture is session-scoped (one shared DB for the whole run), not per-test-isolated — a true per-test DB would need `db/database.py`'s module-level `engine`/`SessionLocal` singletons restructured, which wasn't worth it for this pass. Test functions use distinct identifiers per concern (the same convention the original standalone scripts used) specifically so they can safely share one DB.

- `tests/test_cameras.py` — CRUD, duplicate rejection, CSV/JSON bulk import, gap-analysis, ingest-sync auth/error-handling.
- `tests/test_adapters.py` — factory resolution across HLS/ONVIF/Vendor SDK, 404 on missing camera.
- `tests/test_ai.py` — orchestrator profile gating, invalid-profile 422.
- `tests/test_watchlists.py` — real DB-backed matching end-to-end, including `match_count` incrementing.
- `tests/test_alerts.py` — the severity rubric specifically: anomaly type→severity mapping (including the unmapped-type fallback), and that routine unmatched detections don't become alerts.
- `tests/test_investigations.py` — the full auth → watchlist match → persisted alert → acknowledge → open investigation → timeline → map trace → evidence flow, in one test since each step depends on the last.

Minimum bar before the hackathon-day live test: the Investigations map-trace flow has an end-to-end test against at least one real ingest-API camera, not only synthetic data — this is the graded functional test, it cannot be mock-only. **`tests/test_investigations.py` proves the shape works end-to-end against synthetic data (real DB writes, real joins, real timestamps) — the literal "against a real ingest-API camera" part is still blocked on organizers publishing a live host** (`INGEST_API_BASE_URL` unset, `core/config.py`); nothing else is missing to run it for real once that exists.

## 9. Scalability posture (design ceiling, not pilot requirement)

Statewide target is ~80,000 cameras. The pilot does not need to run at that scale, but the architecture must show a credible path:

- **Central / regional / edge compute split**: today's single AI orchestrator is the "central" tier; the adapter-factory pattern is already positioned to run per-region without redesign (multiple adapter-factory instances, one registry).
- **Edge-side inference** (see prd.md §13.2) is the concrete lever for bandwidth at scale — detect near the camera, ship events/metadata centrally instead of full video, rather than assuming infinite backhaul bandwidth for 80,000 streams.
- Storage tiers, GPU/accelerator sizing, and phased-rollout-by-district are HLD content (prd.md §14), not code — captured here only as the constraint the adapter/orchestrator split must remain compatible with.
- [ ] Event bus choice for Phase 2+ scale-out: **Redis Streams vs. Kafka — not yet decided.** `backend/agents/` is reserved for this; do not build against either until decided (see prd.md §15 decision log).

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
cd backend
python -m venv .venv && .venv\Scripts\activate      # or source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt                       # pinned, ported from contrib/aneesh/backend
cp ../.env.example ../.env                             # DATABASE_URL, HLS_OUTPUT_DIR
uvicorn main:app --reload --port 8000
```

`requirements.txt` is now pinned (ported from `contrib/aneesh/backend/requirements.txt`; `requests`, `bcrypt`, `pyjwt`, `pytest`, `httpx` added during later passes — see the file's comments for why `bcrypt` is used directly rather than via `passlib`). Default `DATABASE_URL` is SQLite (`sqlite:///./gvista.db`); switch to a Postgres+PostGIS URL and run `migrations/001_postgis_setup.sql` once ready (§4). `ffmpeg`/`ffprobe` must be separately installed and on `PATH` for `video/ffmpeg_runner.py` (real RTSP→HLS transcoding) and `routers/health.py`'s `ffmpeg_available` check — not a pip dependency.

On first startup, a bootstrap `ADMIN` account is created automatically (username/password from `ADMIN_BOOTSTRAP_USERNAME`/`ADMIN_BOOTSTRAP_PASSWORD`, defaulting to `admin`/`changeme123` — change these before any real use, §7). Run `pytest` per §8 to verify the install.

## 12. Backend feature checklist

Full status as of the `contrib/aneesh/` port, 2026-09-12. **Done** = ported and present in `backend/` (verify against §12.1 before trusting further). **Fix needed** = real code exists but has a known correctness gap. **Not built** = still an empty stub, no shortcuts taken.

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
- [x] Pydantic v1-style patterns audited across all of `backend/` (`@validator`, `.dict()`, `.json()` on a model, `orm_mode`, `class Config:`, `@root_validator`) — nothing found beyond the one already-fixed `schemas/camera.py` validator. No further action needed unless more of `contrib/aneesh/` gets ported later.

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
- [x] Converted `tests/*.py` to real pytest — 28 tests passing (§8)
- [x] End-to-end vehicle-trace test — done against synthetic data (`tests/test_investigations.py`); the "real ingest-API camera" part is blocked on external access, not on anything left to build here (§8)

Two real bugs were caught and fixed while building this, both from writing an actual test rather than trusting the code: a `passlib`/modern-`bcrypt` incompatibility that broke password hashing entirely (switched to `bcrypt` directly, see `requirements.txt`'s comment), and a `DetachedInstanceError` from reading ORM attributes after the session that fetched them had committed and closed (`intelligence/alert_engine.py` — fixed by snapshotting needed fields before the commit, same fix as the earlier §12.3 watchlist bug, so this pattern is now worth watching for elsewhere).

### 12.5 Remaining known gaps (small, deliberate, or blocked on something external)

- [ ] Fuzzy (Levenshtein/Jaro-Winkler) watchlist matching — needs real OCR error-rate data to set a defensible threshold; deliberately not guessed (`intelligence/watchlist_matcher.py`'s docstring)
- [ ] Appearance-based re-identification for cross-camera correlation beyond exact plate match — ai_pipelines.md §5 differentiator, not started
- [ ] Auth not enforced on every route that arguably needs it — only writes/privileged reads got it in this pass (§7)
- [ ] Audit log not wired into every alert *view* (only actions) — worth confirming that's really the intent given the log-volume implications (§7)
- [ ] ER diagram still not drawn, now overdue given 7 models have real schemas (§4)
- [ ] Onboarding source (bulk/manual/API) not a stored column on `Camera` (§4)
- [ ] Per-test database isolation in pytest — session-scoped DB works but isn't ideal (§8)
- [ ] Single consolidated threat-model doc (§7)
- [ ] `/api/ingest` field-mapping in `integration/ingest_sync.py` is a best-effort guess at undocumented parts of the payload shape — will need adjusting once a real payload can be inspected
