# G-VISTA — Product Requirements Document

**Gujarat Video Intelligence & Surveillance Technology Architecture**
Status: Draft Rev D (docs consolidated) · Supersedes all prior PRD/ARCHITECTURE drafts in `prometheus-1` · Last updated 2026-09-12

This is the single authoritative **product** document: scope, goals, hackathon compliance, personas, and the master feature/submission checklists. Implementation depth lives in three companion docs so this one stays readable:

- **[frontend.md](frontend.md)** — design system, information architecture, page-by-page spec, frontend setup.
- **[backend.md](backend.md)** — integration-model decision, adapter contracts, data layer, APIs, security, testing, backend setup.
- **[ai_pipelines.md](ai_pipelines.md)** — detector contracts, AI orchestrator, intelligence correlation, dataset strategy.

Where any of the three conflicts with this document on a product-scope question, this document wins; where this document is silent on an implementation detail, the relevant companion doc wins.

---

## 0. Context this PRD is written under

- This is a **government hackathon submission** to a real, verified competition: the **Gujarat Police CCTV Integration Hackathon 2026** (a.k.a. "Gujarat Police Innovation Challenge"), run by the Home Department / State Crime Records Bureau at `sentinel.gujarat.gov.in`. §0.1 records what was verified directly from that portal on 2026-09-12 and is the source of truth for every mandatory constraint below.
- The product must visibly follow government digital-service norms, not consumer-SaaS or "hacker dashboard" conventions. Reference: `india.gov.in` (light background, red/white/navy institutional palette, visible accessibility toolbar, card-based service tiles) — independently confirmed by the hackathon's own portal, which ships the same pattern. Full design system in frontend.md §1.
- **Real data is coming, incrementally**, and as of §0.1 there is now a *documented, live* source for it (the simulated feed API — backend.md §2), not just future collection. Dataset intake strategy is in ai_pipelines.md §6.
- This PRD governs the fresh-start codebase at `github.com/ianeeshthakur/prometheus-15`.

### 0.1 Hackathon compliance snapshot (verified against sentinel.gujarat.gov.in, 2026-09-12)

**Dates:** registration/submission closes **15 Sep 2026**; Phase 1 sandbox event **22–23 Sep 2026**; results **24 Sep 2026**. Today is 2026-09-12 — the build window is tight; §13/§14 exist specifically to keep effort pointed at what's graded.

**Scope is 26 government departments, not Police-only.** Camera ecosystems belong to Health, Police, GSRTC (transport), Panchayat, Municipal Corporations, Food & Civil Supplies, RTO, and others, spread ~1,000 km across the state (Valsad, Dahod, Somnath, Jamnagar, Dwarka cited as examples), on both analog and IP cameras, with inconsistent storage (cloud vs. local, 7–15+ day retention). The platform's identity should read as a **cross-department public-safety platform led by Gujarat Police / Home Department**, not an exclusively police tool — this affects copy and iconography, not the core surveillance-first UX, since Police remains the primary operator persona.

**Model 1 (Centralised CCTV Registry & GIS Foundation) is compulsory for every submission,** and must be paired with at least one other model. It is metadata/registry-only (no live streaming by itself) and requires: bulk/manual/API-based camera onboarding, an interactive GIS map with filters, camera health monitoring, **gap-analysis reports**, and role-based search. This is satisfied inside the existing 8-page structure (frontend.md §3.1, §3.7, §3.8), not a 9th page.

Three further reference models exist (hybrid/custom allowed): Model 2 (Unified Viewing & Selective Analytics), Model 3 (VMS Federation/middleware), Model 4 (Central VMS & AI Platform). **This project is Model 1 (mandatory) + Model 2 (core) + Model 4 elements** — full rationale in backend.md §1.

**A real, documented ingest API already exists** for the hackathon's simulated dataset (~50 live-simulated feeds, 30+ real cameras × ~12h footage, across Health/Police/GSRTC/Panchayat/Municipal): a catalogue endpoint plus RTSP/WHEP/HLS URLs per camera. Full contract and pre-submission technical checklist in backend.md §2.

**Live technical test on hackathon day:** organizers give a vehicle number; the system must trace it across the simulated camera network and produce a timestamped, location-wise route. This is exactly the Investigations "map trace" flow (frontend.md §3.5, ai_pipelines.md §4) — it is not just a nice UI, it is the graded functional test, so that flow must work end-to-end against the real ingest API, not only mock data.

**Submission deliverables** (§14): a Solution Presentation (PPT/PDF) with model justification, a Technical Proposal/HLD with architecture diagrams, a 2–3 minute demo on the team's own feed, a **live demonstration against the actual government feed** with a screen-recorded video plus an output report showing detected vehicles/plates with timestamps, and a GitHub/GitLab repo or hosted URL. **Mock-ups, animations, and concept videos are explicitly rejected** — every demoed capability must be real, working software against the real feeds (mock data stays fine for local dev, per the mode-honesty rule in frontend.md §3.0, just not for the submission demo).

**Judging criteria** (§11): live test-case success, presentation/HLD clarity, architecture soundness, platform maturity, analytics output quality, statewide scalability readiness (~80,000-camera design ceiling, §3), and submission completeness. Bonus points (not substitutes) go to hybrid architectures, advanced cross-camera tracking, edge processing/bandwidth optimization, stronger cybersecurity, and automated alerting/dashboards — directly informing §13.

**Suggested (non-mandatory) stack:** React, Python or Node.js, PostgreSQL+PostGIS, Kafka/RabbitMQ, TensorFlow/PyTorch, FFmpeg, GStreamer, Kubernetes, S3-compatible storage, Leaflet/OpenLayers. Matches the current React (Vite) + FastAPI choice (`client/` + `server/`, prd.md §15); the one concrete gap is PostGIS (backend.md §4).

---

## 1. Product overview

G-VISTA is a video-intelligence platform for Gujarat Police and allied departments: it integrates existing, heterogeneous CCTV infrastructure (RTSP/HLS/ONVIF/vendor VMS) without requiring hardware replacement, runs AI analytics on the feeds (vehicle/person/plate detection, OCR, anomaly detection), correlates detections against watchlists, raises severity-scored alerts, and gives investigators a case-file workspace to trace an entity across cameras and build evidence.

Core loop: **Detect → Identify → Correlate → Trace → Alert → Investigate.**

## 2. Goals

- Give a control room a single, low-noise view of camera health and active incidents across districts.
- Turn raw detections into actionable, correctly-severity-scored alerts — never overwhelm the operator with raw AI output.
- Give a field investigator a coherent case-file workspace: one place to see everywhere an entity was seen, with evidence attached.
- Be demonstrably accessible and compliant with government digital-service norms (frontend.md §1, §2) — this is graded, not optional polish.
- Be honest about mock vs. real: every screen must clearly indicate when it is showing simulated data vs. a live pipeline result.

## 3. Non-goals (v1)

- Facial recognition / biometric identification — gated behind an explicit authorization workflow if ever built, never a default (India's DPDP Act, 2023 and the Puttaswamy privacy judgment; see backend.md §7).
- A native mobile app. Web-responsive only; the command center must be usable on a tablet, not redesigned for it.
- Operating an actual 80,000-camera fleet. That number is the platform's design ceiling, not a pilot requirement (backend.md §9) — the pilot demonstrates correctness on however many real cameras/clips the collected dataset covers.
- PTZ camera control, two-way audio, edge NVR firmware integration.

## 4. Design mandate — government norms, non-negotiable

Because this is judged as a government product, the frontend must satisfy these constraints on every screen (full spec in frontend.md §1–§2):

1. Light, institutional visual language by default; dark mode is an explicit opt-in only.
2. Visible accessibility controls always present in the header: font-size stepper, language switch (EN/HI/GU), high-contrast toggle, skip-to-content link.
3. WCAG 2.1 AA minimum everywhere.
4. Multi-page, not mega-dashboard — fixed at **8** top-level pages (frontend.md §3).
5. The 7 C's content standard (frontend.md §2) checked on every page.

## 5. Information architecture (summary — full spec in frontend.md §3)

Eight pages, shared shell: **Dashboard** (`/`) · **Live Cameras** (`/cameras`) · **Alerts** (`/alerts`) · **Watchlists** (`/watchlists`) · **Investigations** (`/investigations`) · **Analytics & Reports** (`/analytics`) · **System & Network** (`/system`) · **Administration** (`/admin`). The mandatory Model 1 registry/GIS/gap-analysis/role-based-search requirements are folded into Dashboard, System & Network, and Administration rather than a 9th page.

## 6. Personas

| Persona | Primary pages | Primary job |
|---|---|---|
| Control room operator | Dashboard, Live Cameras, Alerts | Monitor feeds, triage and escalate alerts |
| Field investigator | Investigations, Watchlists | Build a case, trace an entity, attach evidence |
| ACP / DSP (command) | Analytics & Reports, Dashboard | District oversight, periodic reporting |
| System administrator | System & Network, Administration | Camera onboarding, platform health, access control |

## 7. Design system

Full token set (palette, type, spacing, components) in **frontend.md §1**. Summary: light institutional theme, navy primary, saffron used sparingly as a secondary accent, semantic status colors always paired with icon+label, Noto Sans for UI text (renders Devanagari/Gujarati for the language switch), a monospace face for IDs/plates/timestamps.

## 8. Dataset strategy (summary — full plan in ai_pipelines.md §6)

No dataset exists yet at PRD-writing time. Four categories are being collected incrementally (video footage, camera metadata, vehicle/plate images, anomaly/incident data), each with a fixed intake folder contract (`datasets/raw/…` → `processed/` → `splits/`) so a dataset can be dropped in without a schema negotiation. Separately, the hackathon itself already provides a live streaming source (§0.1) for inference — that's distinct from these training datasets.

## 9. Backend summary (full depth in backend.md)

Already scaffolded: adapter-factory protocol normalization (RTSP/HLS real, ONVIF/Vendor-SDK stubbed), a profile-driven AI orchestrator behind swappable mock detector interfaces, a DB-backed camera registry, and `server/agents/` reserved for Phase 2+ event-bus scale-out and the Phase 3+ LLM investigation copilot. Integration-model decision (Model 1+2+4 hybrid) and the real ingest API contract are in backend.md §1–§2.

## 10. Non-functional requirements

- Event-to-alert latency under 3 seconds once a real pipeline is running.
- Every page usable via keyboard alone, screen-reader-tested, WCAG 2.1 AA.
- Graceful degradation: if AI/alerting is down, camera playback keeps working; the footer status strip says so honestly rather than silently going stale.
- No credential or raw camera IP ever reaches the browser.

## 11. Success metrics

| Dimension | What proves it |
|---|---|
| Government-norms compliance | Passes a WCAG 2.1 AA check; accessibility bar functions on every page |
| Real-data handling | At least one detector demonstrably fine-tuned on a dataset from ai_pipelines.md §6, with a reported before/after metric |
| Information architecture discipline | Exactly 8 top-level pages, each satisfying its single stated purpose |
| Coherence | Identical shell verified present and consistent across all 8 pages |
| Investigator usefulness | A full entity trace (search → timeline → map → evidence) completable without leaving Investigations |
| **Live test-case success** (graded, §0.1) | Given a vehicle number on hackathon day, Investigations traces it across the real ingest-API feeds and produces a timestamped, location-wise route |
| **Model 1 compliance** (mandatory, §0.1) | Registry, GIS map with filters, camera health, gap-analysis report, and role-based search all demonstrably working — not just a diagram claim |
| **Submission completeness** (§14) | Every item in §14's checklist has an owner and is either done or explicitly deferred with a reason |

## 12. Open items

- Exact dataset contents/format — unknown until collection completes (ai_pipelines.md §6).
- Hindi/Gujarati translation content — the language switch is required in the UI for v1; full translated strings can follow.
- Event bus choice (Redis Streams vs. Kafka) for Phase 2 scale-out — not a frontend-blocking decision, tracked in backend.md §9.
- Licensing/access verification for the pretrained datasets named in ai_pipelines.md §7 (sourcing itself is researched — recovered from `contrib/aneesh/docs/prd/G-VISTA-Blueprint.md` §11 — but each dataset's license needs confirming before fine-tuning against it).

## 13. Feature checklist — everything the project needs, by priority

Consolidated master list. **Baseline** = mandatory, judged pass/fail. **Differentiator** = bonus-scored, and where a real win margin comes from since every team clears the baseline. **Stretch** = only after the first two tiers are solid. Domain-specific checklists (with implementation-level detail) live at the end of frontend.md §5, backend.md §12, and ai_pipelines.md §8 — this is the roll-up.

### 13.1 Baseline (mandatory — the project fails without these)

- [ ] Model 1 registry: camera CRUD, bulk CSV/JSON import, `/api/ingest`-driven auto-onboarding, department + district tagging — **backend fully done** (CRUD, CSV/JSON import, and the `/api/ingest` sync endpoint all real and tested — `server/routers/cameras.py`, backend.md §12.4), **frontend not connected** (Cameras/System pages still read `lib/mock-data.ts`); the one real backend gap left is that `/api/ingest` sync is unverified against the actual hackathon endpoint, which isn't published yet
- [ ] Interactive GIS map (Leaflet) with the accessible "view as list" fallback — **frontend done** on Dashboard (mock data); filters by department/status/protocol not yet on the map itself (only on the Cameras grid); PostGIS migration is now written (backend.md §4) but unverified against a real Postgres instance
- [ ] Camera health monitoring (heartbeat, FPS, restart count) surfaced on Cameras — **frontend done** (mock data), **backend done** (`routers/adapters.py`, verified working), **not connected to each other**; System & Network page not built
- [ ] Gap-analysis report: coverage-shortfall table/heatmap by district × department — **frontend done** (Dashboard summary + placeholder link, mock data), **backend query now real and tested** (`GET /api/cameras/gap-analysis`, backend.md §12.4) — not yet connected to each other
- [ ] Role-based search and RBAC (department-scoped users vs. platform admin) — **backend fully done**: JWT auth, `ADMIN`/`OPERATOR` roles with department scoping, audit log (backend.md §7/§12.4) — frontend has no login UI yet, and "role-based search" specifically (filtering registry results by the caller's department_scope) isn't enforced at the query level yet, only the role model exists
- [ ] Live playback of the real ingest streams via all three documented protocols (RTSP for inference, WHEP for browser preview, HLS for dashboard/mobile) — not just mock thumbnails. Frontend player exists but honestly shows "not available in DEMO mode" (frontend.md §3.2); backend adapters real (§3) but not connected to any frontend player, and the real ingest API host is still unconfigured
- [ ] ANPR + person/vehicle detection running against the real simulated feeds, feeding the alert engine — **backend orchestrator real and tested** (`server/ai/`), and now genuinely **feeds a persisted alert with real severity scoring** (backend.md §12.4) — still running against mock/synthetic frames only, not yet connected to a real camera or to the frontend
- [ ] Cross-camera entity trace: search a plate/description → timeline → map route — the literal hackathon-day test. **Backend fully built and verified against synthetic data** (`GET /api/investigations/{case_uid}/trace`, exact-identifier correlation via `intelligence/entity_graph.py`, backend.md §12.4) — frontend Investigations page is still a placeholder, and there's no real ingest-API camera to verify against yet
- [ ] Alert triage queue with severity scoring, acknowledge/escalate/open-investigation actions — **backend fully done and tested** (real severity rubric, status transitions, one-click investigation-opening from an alert, backend.md §12.4) — frontend Alerts page is still a placeholder
- [ ] Watchlist matching (stolen vehicle / wanted person / custom) feeding alerts — **backend fully done and tested** (exact match, real risk-level-driven severity, match history, backend.md §12.3) — frontend Watchlists page is still a placeholder
- [ ] Full accessibility bar + WCAG 2.1 AA across all 8 pages — judged directly and mirrors the portal's own UI
- [ ] DEMO/LIVE mode indicator, always visible, never ambiguous — protects the "no mock-ups accepted" submission rule
- [ ] Architecture write-up (HLD + diagrams) documenting the Model 1+2+4 hybrid decision

**Where this leaves the baseline (2026-09-12):** the backend side of nearly every item above is now real, tested, and verified — camera registry, adapters, AI orchestrator, watchlist matching, alerts, investigations, RBAC/audit, gap-analysis, and a PostGIS migration all exist and pass 28 pytest tests. What's left to hit baseline is almost entirely **frontend build-out and frontend↔backend wiring** (the Dashboard and Live Cameras pages still read `lib/mock-data.ts`, not the real API), plus the two things nobody here can unblock alone: the hackathon publishing a live `/api/ingest` host, and real camera footage to test protocol/timestamp assumptions against.

### 13.2 Differentiators (bonus-scored — pick these to actually win, not just pass)

- [ ] **Appearance-based re-identification**, not plate-text-only tracking — highest-leverage feature against "advanced cross-camera tracking" bonus scoring (ai_pipelines.md §5)
- [ ] **Edge-side inference option** — answers the ~80,000-camera scalability question and the "bandwidth optimization" bonus line with a working demo (backend.md §9, ai_pipelines.md §5)
- [ ] **Fused, explainable alerts** — one alert shows why it fired: detector, matched entry, confidence, evidence crop (ai_pipelines.md §5)
- [ ] **Automated demo-report generation** — the graded live-feed report becomes a real product export, not a hand-assembled slide (frontend.md §3.6, ai_pipelines.md §5)
- [ ] **Scalability blueprint as a rendered artifact** — an actual diagram/page in the HLD, not prose (backend.md §9)
- [ ] **DPDP-aware privacy posture, visibly enforced** — a real toggle/audit entry in Administration, not just a PRD sentence (backend.md §7)
- [ ] **VAHAN/SARTHI/eGujCop/AFIS/NAFIS integration stubs** — named, clearly-labeled mock adapters so the architecture visibly answers the integration question (backend.md §7)

### 13.3 Stretch (only once 13.1 and 13.2 are demo-solid)

- [ ] Multi-language UI content (Hindi/Gujarati) beyond the switch existing
- [ ] Kafka/event-bus-backed ingestion for true multi-thousand-camera scale
- [ ] Mobile-responsive field-investigator view beyond "usable on a tablet"

## 14. Submission checklist (tracks §0.1's deliverables — keep this current, not aspirational)

| Deliverable | Required content | Status |
|---|---|---|
| Solution Presentation (PPT/PDF) | Model justification (why Model 1+2+4 hybrid), architecture summary, feature highlights from §13 | Not started |
| Technical Proposal / HLD | Architecture diagrams, heterogeneous camera/VMS integration approach, geographic-dispersion handling, scalability plan (§13.2) | Not started |
| Own-feed demo video (2–3 min) | Onboarding a camera, viewing it live, vehicle detection/ANPR firing | Not started |
| Live government-feed demo | Screen-recorded run against the real `/api/ingest` feeds on hackathon day, tracing the assigned vehicle number end-to-end | Not started |
| Output report | Detected vehicles/plates with timestamps, generated from the product (§13.2 automated report), not hand-assembled | Not started |
| Repo / hosted access | GitHub/GitLab link or hosted URL with credentials, kept in sync with what's demoed | This repo |

## 15. Decision log

Carried forward from prior drafts, plus decisions made during the hackathon-alignment pass (2026-09-12). Add new entries here as they're made — this is the single log, do not start a second one in a companion doc.

| Decision | Rationale |
|---|---|
| HLS over WebRTC for the dashboard/mobile video path | Broader compatibility on restricted networks; WHEP is used instead for the low-latency browser-preview case specifically (backend.md §2) |
| Zustand over React Context / Redux for client state | Simpler boilerplate for a page-scoped state shape; no need for Redux's middleware ecosystem at this scale |
| Model 1 (mandatory) + Model 2 (core) + Model 4 (analytics layer) hybrid, not Model 3 | Model 3's middleware/federation layer would duplicate the adapter-factory pattern and contradicts Model 2's "no middleware" requirement; full rationale backend.md §1 |
| PostGIS added to the stack | Required for Model 1's GIS registry and gap-analysis report; on the hackathon's own suggested stack list |
| Exactly 8 top-level pages, Model 1 folded in rather than adding a 9th | Preserves the "multi-page, not mega-dashboard" mandate (§4) while still satisfying every Model 1 sub-requirement |
| Facial recognition gated behind explicit authorization, never default | DPDP Act 2023 / Puttaswamy privacy judgment; also directly answers a judged design dimension when shown as a real toggle |
| Aneesh's `prometheus-1` server/docs migration archived at `contrib/aneesh/`, not deleted, during the government-norms rebuild merge | His old dark-theme PRD/DESIGN lost to the new government-norms versions, but his real ~2,100-line FastAPI backend and detailed AI/pipeline docs were preserved rather than discarded; ai_pipelines.md §7's dataset-sourcing table and backend.md's prior-art pointer were recovered from that archive on 2026-09-12 |
| Aneesh's `contrib/aneesh/backend/` ported into the real `server/` on 2026-09-12 | It was real, working code (adapters, AI orchestrator, camera registry, video streaming, tests) sitting unused while `server/` was still all 1-line stubs; three corrections made during the port (not a verbatim copy): dropped the legacy in-memory `camera_registry` (superseded by the DB-backed Model 1 registry as single source of truth), rewrote `routers/streams.py`'s AI-pipeline loop (the source imported a `detection_service` module that was never actually committed anywhere in the migration — it would have crashed on startup) to call the real `AIOrchestrator` instead, and split flat `models.py`/`schemas.py`/`db.py` into the `models/`/`schemas/`/`db/` packages this doc already specified. Verified end-to-end (server boots, all three ported test suites pass). Full status in backend.md §12 |
| `server/requirements.txt` exact pins relaxed to `>=` minimums | The ported pins (`pydantic==2.6.3` etc., from Feb 2024) predate Python 3.13 and have no prebuilt `pydantic-core` wheel for it, forcing a from-source Rust build that fails without a working MSVC linker. `>=` lets pip resolve to a version with a real cp313 wheel. Re-pin exact versions once the team settles on a deployment Python version |
| `watchlist_matcher.py` does exact matching only, no fuzzy (Levenshtein/Jaro-Winkler) matching | An untuned fuzzy threshold risks false-positive watchlist alerts on a policing tool, which is worse than a missed match — needs real OCR error-rate data to set a defensible threshold, not a guessed cutoff. Revisit once ai_pipelines.md §6's dataset onboarding loop produces that data |
| `match_count` on `WatchlistEntry` is derived (counted from `WatchlistMatch` rows), not a stored counter | Avoids write-consistency drift between a counter and the underlying events; also gives a full match history/audit trail for free instead of just a number |
| Auth via `bcrypt` directly, not `passlib` | `passlib` 1.7.4 (unmaintained since 2020) probes a `bcrypt.__about__` attribute that modern `bcrypt` (>=4.1) removed, breaking password hashing entirely — hit this for real during the backend.md §12.4 build-out |
| Timeline/Map-trace (Investigations) are derived queries against `CameraEvent`/`Alert`, not their own stored tables | The alternative (a dedicated timeline table) would mean writing every event twice; deriving keeps one source of truth and costs nothing since the query is a simple identifier match, not something expensive |
| `intelligence/entity_graph.py` does exact-identifier correlation only, not graph-theoretic re-identification | There's no stable person/vehicle identifier to correlate on beyond an exact normalized plate match yet — appearance-based re-id is a documented differentiator (ai_pipelines.md §5), not built. Exact-match correlation IS the real shape of the hackathon's graded vehicle-tracking test, just without sophistication the data available doesn't yet earn |
| PostGIS migration (`migrations/001_postgis_setup.sql`) written but not run against a real Postgres instance | None is available in this dev environment; the migration is additive (a `geom` column alongside the existing lat/lng floats, kept in sync by a trigger) so it doesn't risk the SQLite dev path either way |
| Fuzzy watchlist matching built but shipped OFF by default (`ENABLE_FUZZY_WATCHLIST_MATCHING=false`) | The edit-distance algorithm itself is well-defined and tested; the *threshold* for what counts as "close enough" isn't — an untuned cutoff risks false-positive alerts on a policing tool, worse than a missed match. Flip the flag once real OCR error-rate data justifies a specific threshold |
| Re-identification interface built (`ai/interfaces.py` `ReIdentificationProvider` + mock) but not wired into `entity_graph.py`'s real trace logic | The mock provider carries zero real appearance information by construction — wiring a fake similarity score into the graded live vehicle-tracking test's actual code path would be dishonest. Build a real embedding model and a real accuracy evaluation before connecting the two |
| Auth now required on every registry/watchlist/alert/investigation/adapter/stream route; only `/`, `/api/health/`, `/api/ai/*` stay open | The earlier state (auth only on some writes) was a real gap, not a deliberate choice — camera locations, watchlist entries, and case data are all sensitive. Liveness/diagnostic endpoints stay open to match common infra practice |
| Audit log wired into individual-record views (`ALERT_VIEWED`, `INVESTIGATION_VIEWED`) but not list endpoints | Logging every page of a triage queue someone scrolls is volume without audit value; logging that they opened *this specific* record is the meaningful signal. A judgment call, not an oversight — revisit if frontend.md §3.8's "every alert view" language turns out to mean something more literal |
| Per-test pytest isolation done at the module level (wipe operational tables between test files), not per-function | A true per-function rewrite needs `db/database.py`'s module-level engine/session singletons restructured, not worth it given no test file actually depends on another's data (verified by running a subset of files out of default order). Module-level cleanup closes the actual risk — cross-file contamination — for much less cost |
| Rate limiting is in-process (`core/rate_limit.py`), not Redis-backed | Only correct on a single backend instance; Redis is already deferred to Phase 2+ scale-out (backend.md §9) and introducing it just for this would be premature. A documented limitation, not an oversight — revisit together with the event-bus decision below |
| XSS defense strips HTML tags at the input boundary rather than HTML-escaping them | This is a JSON API, not a template renderer — storing escaped entities (`AT&amp;T` instead of `AT&T`) would be wrong for every consumer except an HTML template. Escaping belongs at the render layer; stripping at input means no future consumer can be tricked into rendering injected markup, without corrupting the plain-text value for everyone else |
| **Open, not yet decided:** event bus for Phase 2+ scale-out (Redis Streams vs. Kafka) | Tracked in backend.md §9 — do not build against either until decided |
| A real hackathon test rig (`cctv.corp8.cloud` / `103.250.160.189`) got its own config path (`INGEST_CATALOGUE_URL`, `INGEST_STREAM_EMAIL/PASSWORD/HOST/PORT`) rather than repurposing `INGEST_API_BASE_URL` | Its catalogue is a flat fixed URL and its RTSP auth is per-connection credentials in the URL, not the `{base}/api/ingest` shape backend.md §2 documents for the official Sentinel portal — those are two different real contracts, and conflating them would silently break whichever one gets tested second. `INGEST_CATALOGUE_URL` takes priority when set (backend.md §12.7.1) |
| Real RTSP credentials for the corp8.cloud rig live only in the local, gitignored `.env`, never in `.env.example` or any commit | Standard credential hygiene — `.env.example` documents the shape (empty placeholders) so anyone can configure their own; the actual password given by a teammate stays out of git history entirely |
| The corp8.cloud integration (catalogue fetch, RTSP synthesis) is wired and unit-tested but **not verified against the live host from this environment** | This sandbox's own safety layer blocks outbound requests to that host once real credentials are in play (flagged as "exfil scouting") — a reasonable default given a real password was in the conversation. The code is real; the last-mile verification (actual `GET /cameras.json` response shape, an actual RTSP connection) needs to run from a machine that can reach it — `GET /api/cameras/ingest-preview` (backend.md §12.7) is built specifically for that first real run |
| Theft/shoplifting dataset links (Kaggle ×3, a reference notebook, an arXiv paper, a gated Dropbox folder) logged in ai_pipelines.md §7.1 but not downloaded, licensed, or integrated | These target `AnomalyDetector`'s open `anomaly_type` (a differentiator, not pilot-scope §13.1), and — importantly — do **not** help either of backend.md §12.7's still-open blockers (fuzzy-match threshold needs OCR data; re-id needs person/vehicle cross-camera data). Logged for whoever picks up the anomaly-detection differentiator next, not treated as solving an open gap it doesn't actually address |
| `integration/ingest_sync.py` got a preview-only endpoint (`GET /api/cameras/ingest-preview`) and `INGEST_FIELD_ALIASES` config, rather than a better guess at the real `/api/ingest` payload shape | The real payload shape is unverifiable without organizers publishing a host — guessing harder is still guessing. Previewing the raw response before ever writing to the DB, and making a field-name rename a config change instead of a code change, is what's actually achievable now; the field-mapping itself stays open (backend.md §12.7) |
| `intelligence/watchlist_matcher.py` got `calibrate_threshold()`, a precision/recall calculator over labeled examples, rather than a guessed `FUZZY_WATCHLIST_MAX_DISTANCE` | Same reasoning as the existing "fuzzy matching off by default" decision above — there's still no real OCR error-rate data in this environment, and running the calibration tool against synthetic data would just be the same guess with extra steps (tested only that the tool's math is correct, not that any specific threshold is right, backend.md §12.7) |
| Added `ai/classical_reid_provider.py`'s `ColorHistogramReIdentificationProvider` (real OpenCV HSV color-histogram similarity) alongside the existing zero-signal mock, still not wired into `entity_graph.py` | A real, standard, pre-deep-learning CV technique is honest incremental progress over a dimension-only mock — but it's still not evaluated for accuracy on this project's real footage and is fooled by lighting/blind to shape, so gating an actual investigation match on it would repeat the same mistake the mock's docstring warns against. Closes none of ai_pipelines.md §5's re-identification differentiator; only raises the floor above the mock (backend.md §12.7) |
| Teammate Harsifat's separately-developed React/Vite frontend adopted as the production client, superseding the Next.js app this project had been building | Team decision (2026-09-14) — it already had a working Camera Registry and Investigation page with more real UX investment than the Next.js app's equivalent pages (which only had Dashboard + Live Cameras built). Supersedes the earlier "Next.js (App Router) + TypeScript, Zustand" stack choice recorded above; that app is archived, not deleted, at `contrib/nextjs-frontend-archive/` (frontend.md §0/§6 name specific pieces worth porting back, e.g. its accessibility bar) |
| `contrib/aneesh/backend/` (a teammate's own, separately-evolving backend with `intelligence.py`/`operations.py` routers) considered and **rejected** as the production backend in favor of keeping `server/` | `contrib/aneesh/backend/` has no auth, RBAC, rate limiting, JWT revocation, SQL-injection audit, XSS sanitization, or watchlist/alert/investigation persistence — all real, tested work in `server/` (backend.md §12.3–§12.7, 63 passing tests) that would have to be rebuilt from scratch to switch. `server/` was ported from an earlier snapshot of that same source and has since diverged and grown far past it — this is not a rejection of the code's quality, just a "don't discard tested, in-scope work for less-complete work" call |
| Repo reorganized into a `client/` + `server/` + `shared/` + `docs/` monorepo (2026-09-14), replacing the root-level `backend/`/`frontend/` naming | Matches the chosen client (Harsif's app) and server (this session's backend) unambiguously — no more "which `frontend/` is real" confusion now that a second, competing frontend had appeared in the repo. `shared/` is an empty placeholder (its own README explains why) — nothing currently needs cross-language sharing between the Python server and JS client; add to it when something concretely does, not preemptively. `ai/` and `pipelines/` as separate top-level directories were considered and **deferred** — there's no content today that isn't already reasonably placed inside `server/ai/` and `server/intelligence/`, and carving them out now would be reorganizing for its own sake rather than solving a real problem; revisit once there's a concrete reason (e.g. the AI pipeline needs to scale/deploy independently from the API server) |
| `client/`'s fabricated "live" data (Dashboard's fixed stat numbers/7-day sparklines/department donut, TelemetryTicker's 7 hardcoded "LIVE" strings, Investigation's fake patrol-officer ETA/AI-forecast, CameraRegistry's fake maintenance/warranty records) replaced with real backend data or an honest empty/not-tracked state, never fabricated fallbacks | These looked real (animated count-up, a pulsing "LIVE" badge, a plausible 99.94% uptime figure) while never reflecting actual system state — exactly what this project's honesty conventions (backend.md, frontend.md) exist to prevent, and a real risk for a submission judged partly on "platform maturity" by people who might test it live. Where no real endpoint exists for a given number (e.g. per-camera maintenance history, a 7-day detection trend), the UI says so instead of showing a number — see frontend.md §5 for the full per-page accounting |
| The fake "nearest patrol officer" (name, badge ID, ETA) and "AI forecast" predicted-next-location in `Investigation.jsx` were dropped entirely, not disclaimed and kept | Nothing on the real backend tracks officer location or predicts future position — keeping the UI would mean permanently-fake data with no path to becoming real, unlike e.g. `ColorHistogramReIdentificationProvider` (a real floor above a mock, decision above). The prediction-playback slider was repurposed into real trace playback (stepping through the real chronological sightings `GET /api/investigations/{case_uid}/trace` returns) instead — same interaction, now honest |
| `CameraMap.jsx` (~1300 lines, `client/`) left unrewired to real camera data this pass, flagged as a known gap (frontend.md §5.1) rather than rushed | Deep internal coupling to its own hardcoded `data/cameras.js` shape (clustering, animation, popups); a safe rewrite deserves its own pass, not a change bundled into a Dashboard edit that already touched five other files. The mapping work itself is mostly field renames once someone does sit down with it — `api.getCameras()`'s shape is close to the fake data's shape already |
| `Analytics.jsx`'s CSV export (entity/camera/district/confidence/timestamp from real `api.getAlerts()`) *is* prd.md §0.1's "report showing detected vehicles/number plates with timestamps" submission deliverable, not a placeholder for one | Built directly against real alert data with no new charting-library dependency (breakdowns are plain proportional bars); satisfies a graded requirement the moment real alerts exist, rather than needing a follow-up pass before it counts |
| `client.js`'s admin-only methods (`getUsers`, `getAuditLog`, `getFacialRecognitionStatus`) now throw a real error on a non-2xx HTTP response instead of silently falling back to an empty list | Caught during this pass: the original pattern conflated "backend unreachable" (fall back to mock, correct) with "backend reachable but denied you" (a real 403, was being swallowed into a fake empty result) — an OPERATOR account would have seen "0 users" indistinguishable from a real empty registry. Network failure still falls back to mock/empty, matching the rest of the client's behavior; only a real HTTP error now surfaces as one |

## 16. Roadmap

Phased against the hackathon's own calendar (§0.1), not an arbitrary internal schedule.

- **Phase 0 — now through submission (by 2026-09-15):** everything in §13.1 (baseline) working end-to-end against the real ingest API, plus the HLD/architecture write-up and as many §13.2 differentiators as time allows. This is the bulk of the remaining work.
- **Phase 1 — sandbox round (2026-09-22–23):** live technical test readiness — the vehicle-tracking flow must run live, unattended, against organizer-provided feeds; own-feed and government-feed demo videos recorded per §14.
- **Phase 2 — if selected as a finalist (post 2026-09-24):** production-round build-out — this is where stretch items (§13.3), the event-bus decision (§15), and real dataset fine-tuning (ai_pipelines.md §6) get prioritized, since Phase 1 prize money is explicitly structured as a grant toward this phase.
