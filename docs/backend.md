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

- [x] RTSP consumed over TCP, never UDP — enforced in `video/ffmpeg_runner.py` (`-rtsp_transport tcp` on both the ffprobe connection test and the ffmpeg transcode command). **Not yet confirmed on the `adapters/rtsp.py` OpenCV path** — `cv2.VideoCapture` defaults to UDP; needs `OPENCV_FFMPEG_CAPTURE_OPTIONS` set before this is true end-to-end (flagged in that file).
- [ ] Timestamp-based timing logic (don't assume constant frame rate — the simulated middleware synchronizes recorded footage onto a common timeline) — not yet implemented; current adapters timestamp frames at local read-time (`datetime.now()`), not from stream metadata.
- [x] Reconnection with exponential backoff on every adapter — implemented in `video/stream_manager.py` (`MAX_RESTARTS=3`, `RESTART_DELAY_SECONDS=5`) for the FFmpeg/HLS path. **Not yet implemented** on `adapters/rtsp.py`/`hls.py` directly (they report `OFFLINE`/`DEGRADED` on failure but don't self-reconnect — that's currently only the stream_manager's job).
- [ ] Mixed codec/resolution handling — not yet tested against real heterogeneous feeds (no real cameras connected yet).
- [x] Adapter health surfaced per-camera (protocol, last heartbeat, FPS, restart count) — `routers/adapters.py` (`/adapter/health`) and `video/stream_manager.get_stream_status()` both return this; feeds frontend.md §3.2/§3.7.
- [ ] Error reporting capturing camera id, exact URL, client + version, UTC timestamp, and client-side error log — not yet implemented as a structured format; currently just Python `logger` calls.

## 3. Adapter contracts (`backend/adapters/`)

Every adapter normalizes its protocol into the same `NormalizedFrame` shape so the AI orchestrator (ai_pipelines.md §1) never needs to know which protocol produced a frame.

- **RTSP** (`rtsp.py`, real, ported) — headless OpenCV capture, credential handling (URL kept instance-private, never returned), graceful `OFFLINE` status on failure. Primary adapter against the real ingest API (§2), pending the TCP-transport confirmation noted above.
- **HLS** (`hls.py`, real, ported) — `.m3u8` ingestion into the same `NormalizedFrame` shape as RTSP; used for the dashboard/mobile/restricted-network path.
- **ONVIF** (`onvif.py`, ported) — explicitly returns `UNSUPPORTED`, not faked. [ ] Profile S discovery/media negotiation — not yet built; no authorized ONVIF test hardware available.
- **Vendor SDK** (`vendor.py`, ported) — explicitly returns `UNSUPPORTED`, not faked. [ ] ctypes wrapper strategy — [ ] decide which vendor to implement first once real vendor VMS access is available.
- **Factory** (`factory.py`, real, ported+adapted) — resolves the adapter by DB-registry lookup only (legacy in-memory fallback dropped, see §0).
- **Discovery/normalization** (`integration/discovery_adapter.py`, real, ported) — `SentinelCameraSource.normalize()` maps arbitrary catalogue JSON/CSV rows into `CameraCreate`, with per-field validation errors (used by the bulk CSV/JSON importers in `routers/cameras.py`). [ ] True network-scan/WS-Discovery auto-onboarding is a separate, still-unbuilt capability despite the module name (kept for continuity with the original migration).

## 4. Data layer

- Postgres, extended with **PostGIS** (currently missing — needed specifically for Model 1's GIS registry, the coverage gap-analysis report, and department/district spatial queries; suggested by the hackathon's own stack list). `backend/db/` needs a PostGIS-aware migration before the registry can serve real geo queries.
- [ ] **Migration plan**: SQLite prototype (current `.env.example` default) → PostgreSQL/PostGIS. Not yet written.
- Camera registry rows carry: department (one of 26), district, protocol, vendor, geolocation (plain lat/lng floats today, PostGIS point once migrated), status, and `ai_enabled`. Onboarding source (bulk/manual/API) is not yet a stored column — currently inferred only by which endpoint was called, not persisted per-row; see §12.
- `backend/models/camera.py` is **real, ported**, backed by `backend/schemas/camera.py` (Pydantic) and `backend/services/camera_service.py` (CRUD + idempotent upsert). `alert.py`, `event.py`, `investigation.py`, `watchlist.py`, `user.py` under both `models/` and `schemas/` remain empty stubs — contrib had no equivalent to port; these need real schema design from scratch (start from `lib/types.ts`'s `Alert`/`CameraEvent` shapes on the frontend side, already decided there).
- [ ] **ER diagram** — not yet drawn; only `Camera` has a real schema so far, drawing it now would be premature.

## 5. Pipelines owned by the backend

(Pipelines 3 and 4 — AI video analytics and intelligence correlation — are AI-domain and live in ai_pipelines.md.)

### Pipeline 1 — Camera registry
Camera onboarding via manual entry, CSV/JSON bulk import, and the `/api/ingest` catalogue (§2) — all three paths required by Model 1. `camera_uid` is the deterministic key; upserts must be idempotent (re-importing the same catalogue must not create duplicates).
- [x] Manual (`POST /api/cameras/`), CSV (`POST /api/cameras/import/csv`), and JSON (`POST /api/cameras/import/json`) onboarding all implemented and tested (`tests/test_cameras.py`).
- [x] Idempotent upsert by `camera_uid` — `services/camera_service.upsert_camera()`, with a race-condition retry on `IntegrityError`.
- [ ] The `/api/ingest` catalogue path (§2) specifically — the JSON import endpoint is generic enough to accept it, but nothing yet calls the hackathon's real endpoint and feeds it through. That sync job is unbuilt.

### Pipeline 2 — Protocol normalization
The adapter factory (`backend/adapters/factory.py`) selects RTSP/HLS/ONVIF/Vendor-SDK per camera and normalizes output into `NormalizedFrame` before handing off to the AI orchestrator.
- [x] Factory dispatch logic + `NormalizedFrame` schema — implemented; RTSP/HLS paths real, ONVIF/Vendor explicitly `UNSUPPORTED` per §3.

### Pipeline 5 — Alerts & investigation
Alert severity scoring (consumes AI orchestrator + intelligence-correlation output — ai_pipelines.md §3), delivery (web only — no mobile app per prd.md §3 non-goals, so this is resolved, not open), and investigation case-file CRUD backing frontend.md §3.5.
- [x] Live event delivery — `routers/streams.py`'s `/api/streams/events/stream` SSE endpoint + `intelligence/alert_engine.py` pub/sub, wired to the real `AIOrchestrator` output (plates/persons/anomalies → `NormalizedEvent` → `alert_engine.process_event()`).
- [ ] **Watchlist matching is currently a single hardcoded plate string** in `alert_engine.py` (`"GJ05XX7821"`) — a placeholder from the original migration, not real DB-backed matching. `intelligence/watchlist_matcher.py` is still an empty stub; needs `models/watchlist.py` to exist first.
- [ ] Severity scoring rubric — not yet defined; must map to the CRITICAL/HIGH/MEDIUM/LOW/INFO badges in frontend.md §3.3.
- [ ] Alert persistence — events are broadcast live via SSE but never written to a DB table (`models/alert.py` doesn't exist yet), so there is no alert history/query API yet, only the live stream.
- [ ] Case-file CRUD + evidence attachment backing the Investigations detail tabs — `models/investigation.py` and `routers/investigations.py` are still empty stubs.

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
| GET | `/` | `main.py` | liveness |

**Not implemented — files are still empty placeholders, deliberately not included in `main.py`** (including an unimplemented router would break startup): `auth.py`, `alerts.py`, `watchlists.py`, `investigations.py`. Building any of these means: write the router, populate its `models/*.py` + `schemas/*.py` pair, then add the `app.include_router(...)` line in `main.py`.

## 7. Security & privacy posture

- No credential or raw camera IP ever reaches the browser (carried forward unchanged from the project's original rules).
- **Facial recognition / biometric identification** — gated behind an explicit authorization workflow if ever built, never a default. Grounded in India's DPDP Act, 2023 and the Puttaswamy privacy judgment. Surface this as a real, auditable toggle in Administration (frontend.md §3.8), not just a policy sentence — a differentiator against the hackathon's "cybersecurity/privacy/RBAC/audit" judged design dimension.
- RBAC: department-scoped users vs. platform admin (feeds Model 1's "role-based search" requirement, frontend.md §3.7) plus a full audit log (frontend.md §3.8) — who/what/when for every alert view, case action, and config change.
- **Real government database integration** (VAHAN, SARTHI, eGujCop, AFIS, NAFIS) is out of scope for the pilot — no real credentialed access. Model these as clearly-labeled mock adapters (never silently fabricated data) so the architecture visibly answers the integration question without claiming real access it doesn't have.
- [ ] Single consolidated threat model / security posture doc — not yet written; this section is the seed of it.

## 8. Testing strategy

Ported from `contrib/aneesh/backend/`: these are live-server integration tests (start `uvicorn main:app`, then run the script; not pytest-collected unit tests) that assert against real HTTP responses.

- [x] `tests/test_cameras.py` — camera CRUD, duplicate rejection, CSV/JSON bulk import (including per-row error reporting and idempotency).
- [x] `tests/test_adapters.py` — factory resolution across HLS/ONVIF/Vendor SDK, 404 on missing camera. (The original's legacy-registry test case was dropped along with that module, §0.)
- [x] `tests/test_ai.py` — orchestrator profile gating (TRAFFIC vs SECURITY output shape), invalid-profile 422.
- [ ] `tests/test_alerts.py` — still an empty stub; nothing to test yet since alerts aren't persisted (§5 Pipeline 5).
- [ ] Convert these to pytest (currently plain scripts with `assert` + `print`, run manually against a live server) so they run in CI.
- Minimum bar before the hackathon-day live test: the Investigations map-trace flow (frontend.md §3.5) has an end-to-end test against at least one real ingest-API camera, not only mocked data — this is the graded functional test, it cannot be mock-only. **Not yet possible** — investigations aren't built (§5), and no real ingest-API host is configured (`INGEST_API_BASE_URL` unset, `core/config.py`).

## 9. Scalability posture (design ceiling, not pilot requirement)

Statewide target is ~80,000 cameras. The pilot does not need to run at that scale, but the architecture must show a credible path:

- **Central / regional / edge compute split**: today's single AI orchestrator is the "central" tier; the adapter-factory pattern is already positioned to run per-region without redesign (multiple adapter-factory instances, one registry).
- **Edge-side inference** (see prd.md §13.2) is the concrete lever for bandwidth at scale — detect near the camera, ship events/metadata centrally instead of full video, rather than assuming infinite backhaul bandwidth for 80,000 streams.
- Storage tiers, GPU/accelerator sizing, and phased-rollout-by-district are HLD content (prd.md §14), not code — captured here only as the constraint the adapter/orchestrator split must remain compatible with.
- [ ] Event bus choice for Phase 2+ scale-out: **Redis Streams vs. Kafka — not yet decided.** `backend/agents/` is reserved for this; do not build against either until decided (see prd.md §15 decision log).

## 10. Deferred / explicitly out of scope for the pilot

- Model 3-style VMS federation middleware (§1).
- Kafka/Redis Streams event bus (§9) — needed at Phase 2+ scale-out, not pilot scale.
- Real credentialed integration with VAHAN/SARTHI/eGujCop/AFIS/NAFIS (§7).
- Facial recognition / biometric ID (§7) unless explicitly authorized.

## 11. Local backend setup

```
cd backend
python -m venv .venv && .venv\Scripts\activate      # or source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt                       # pinned, ported from contrib/aneesh/backend
cp ../.env.example ../.env                             # DATABASE_URL, HLS_OUTPUT_DIR
uvicorn main:app --reload --port 8000
```

`requirements.txt` is now pinned (ported from `contrib/aneesh/backend/requirements.txt`, `requests` added for the test scripts in §8). Default `DATABASE_URL` is SQLite (`sqlite:///./gvista.db`); switch to a Postgres+PostGIS URL once §4's migration lands. `ffmpeg`/`ffprobe` must be separately installed and on `PATH` for `video/ffmpeg_runner.py` (real RTSP→HLS transcoding) and `routers/health.py`'s `ffmpeg_available` check — not a pip dependency.

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

### 12.3 Fix needed (real code, known gap)

- [ ] `adapters/rtsp.py` — confirm `cv2.VideoCapture` is forced to TCP transport (currently only `video/ffmpeg_runner.py`'s path is confirmed TCP); OpenCV defaults to UDP
- [ ] `adapters/rtsp.py`/`hls.py` — no self-reconnect-with-backoff (only the FFmpeg/`stream_manager` path has this); calling code must poll and restart
- [ ] Frame timestamps are local read-time (`datetime.now()`), not derived from the stream's own timing — needed for docs/backend.md §2 checklist item 2 (the hackathon's simulated feeds run on a synchronized timeline, not real-time)
- [ ] `intelligence/alert_engine.py` — watchlist check is a single hardcoded plate string, not a real DB lookup (§5 Pipeline 5)
- [ ] `routers/streams.py`'s AI pipeline defaults every camera to the TRAFFIC profile — no per-camera profile selection wired to frontend.md §3.8 yet
- [ ] Pydantic v1-style `@validator` in the original source was upgraded to v2 `@field_validator` during the port (`schemas/camera.py`) — double-check no other v1-isms were missed if more of contrib gets ported later

### 12.4 Not built (empty stubs, no code exists to fix)

- [ ] `models/`, `schemas/` for `alert.py`, `event.py`, `investigation.py`, `watchlist.py`, `user.py` — design these against `lib/types.ts`'s already-decided frontend shapes (`Alert`, `CameraEvent`, etc.) rather than from scratch
- [ ] `routers/auth.py`, `alerts.py`, `investigations.py`, `watchlists.py` — and their `main.py` wiring, once the models above exist
- [ ] Alert persistence (events broadcast live via SSE, never written to a DB table) + severity scoring rubric (§5 Pipeline 5)
- [ ] Case-file CRUD + evidence attachment for Investigations (§5 Pipeline 5)
- [ ] `intelligence/entity_graph.py`, `watchlist_matcher.py` — real DB-backed watchlist matching and cross-camera entity correlation (ai_pipelines.md §4)
- [ ] `/api/ingest` catalogue-sync job (§2) — nothing yet calls the hackathon's real endpoint; the generic JSON bulk-import endpoint could receive its output once built
- [ ] PostGIS migration (§4) — camera lat/lng are plain floats on SQLite today
- [ ] Gap-analysis query (coverage by district × department) backing frontend.md §3.1/§3.7
- [ ] RBAC + audit log (§7) — `core/security.py` documents the policy but implements nothing yet
- [ ] Facial-recognition authorization gate + toggle (§7)
- [ ] Mock (clearly labeled) VAHAN/SARTHI/eGujCop/AFIS/NAFIS adapters (§7)
- [ ] `video/frame_sampler.py` — rate-limit frame reads to `AI_TARGET_FPS` instead of reading every available frame (currently `routers/streams.py` just sleeps between reads inline)
- [ ] Convert the `tests/*.py` scripts to real pytest (§8)
- [ ] End-to-end test of the vehicle-trace flow against a real ingest-API camera (§8) — blocked on Investigations existing at all
