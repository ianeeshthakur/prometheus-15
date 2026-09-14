# G-VISTA — Frontend

Governs the client application: stack, routing/page inventory, and what's real vs. mock per page. Product scope, goals, personas, and the hackathon compliance context live in [prd.md](prd.md).

Stack: **React 19 + Vite 6**, `react-router-dom` for client-side routing, plain CSS per component (no CSS framework/tokens system yet), Leaflet/`react-leaflet` for mapping.

---

## 0. Why this doc was rewritten (2026-09-14, updated same day after the completion pass below)

This file used to describe a Next.js + TypeScript + Zustand app built earlier in this project. The team decided to standardize on a teammate's separately-developed React/Vite app instead (`client/`, previously `frontend/harsif/`) — it already had a working Camera Registry, Dashboard, and Investigation page with real design/UX investment, where the Next.js app had only Dashboard and Live Cameras built out. The Next.js app was archived at `contrib/nextjs-frontend-archive/` rather than deleted outright at first; it was removed from the repo entirely on 2026-09-14 once its owner had it stored externally (prd.md §15) — see §6 for what was and wasn't ported out of it first.

**This doc now describes `client/` as it actually is**, not an aspirational spec. Where prd.md's page requirements aren't yet met by the current code, that's called out explicitly in §5 rather than glossed over — same honesty convention backend.md uses.

Later the same day, every page identified in §5 as mock-only or stub was wired to the real backend — the one deliberate exception was `CameraMap.jsx`, then flagged as a known remaining gap, and `Model3.jsx`, which stays intentionally unbuilt (a decision, not an oversight — see its entry in §5).

**Still later the same day** (a third pass), the five items the team explicitly asked for next were built: `CameraMap.jsx` is now real too (§5), Model 1's gap-analysis report is surfaced (§5, `CameraRegistry.jsx`), a new System & Network page exists (§3/§5), real WHEP/HLS-style live playback is wired via `hls.js` (§5, `LiveCameras.jsx`), and a real Hindi/Gujarati translation system covers the app shell and every page header (§2/§5, `src/i18n/`). §5 below is the current, up-to-date status — read it, not this paragraph, for what's actually built.

## 1. Local setup

```
cd client
npm install
cp .env.example .env      # VITE_API_BASE_URL, optional -- defaults to http://localhost:8000
npm run dev                 # vite dev server, defaults to http://localhost:5173
```

Runs against the backend at `VITE_API_BASE_URL` (see backend.md §11 to start it). `npm run build` produces a production bundle in `dist/`; both are verified working as of this doc's last update (2026-09-14).

## 2. App shell

- **`App.jsx`** — top-level router. Route protection is real: any route other than `/login` redirects there unless `api.hasSession()` is true (a real backend JWT, or a deliberate mock-mode login when no backend is reachable — see §4).
- **`AccessibilityBar.jsx`** — topmost strip: a real skip-to-content link (`#main-content`, `App.jsx`'s `<main>`), a font-size stepper (3 fixed steps, scales `html`'s own `font-size` so every `rem` measurement in the app scales with it), a high-contrast toggle (swaps `theme.css`'s CSS custom properties to an AAA-checked palette via `html[data-contrast="high"]`), and a language selector wired to real i18n (§2's "Real translation" below).
- **Real translation (`src/i18n/`, added in the third pass)** — `translations.js` (a plain `{en, hi, gu}` dictionary) + `LanguageContext.jsx` (a React context providing `language`/`setLanguage`/`t(key)`, persisted to `localStorage`, provided app-wide from `App.jsx`'s `RoutedApp`). `AccessibilityBar.jsx`'s language `<select>` calls the real `setLanguage()` — previously it only set `document.documentElement.lang` with nothing actually retranslating. **Honest scope, stated in `translations.js`'s own header comment**: covers the app shell (`Sidebar.jsx` nav labels, `Topbar.jsx` brand/subtitle/logout) and every page's `<h1>`/subtitle — the highest-visibility text an operator sees on every screen. Does **not** cover dynamic data (camera names, district/department values, alert descriptions — real content from the database, correctly left as-is), data-table column headers, or every label inside every modal/form. Verified in-browser: switching to Hindi/Gujarati retranslates the whole shell and persists across page navigation; real data stays in its original form throughout.
- **`Topbar.jsx`** — brand header, a pipeline-status indicator strip (currently a static "PIPELINES 1–5 ACTIVE" display, not backend-driven), a LIVE BACKEND/MOCK ENGINE pill (real — `api.checkBackendAvailability()`), a link to Investigation & Alerts, and the user/officer badge (real identity via `api.getCurrentUser()` + working logout; shows "Demo session" when no backend is connected, never a hardcoded fake name).
- **`Sidebar.jsx`** — left nav, 10 items (see §3's routing table; System & Network added in the third pass).
- **`Layout.css`** — shared shell layout (app-shell, app-body, page-content).

**Still not present**: a separate footer status strip (frontend.md's original spec placed the DEMO/LIVE indicator there specifically) — the same honest distinction is covered by the Topbar's LIVE/MOCK pill instead, so the actual requirement (never let real vs. simulated data be ambiguous) is met, just not in a literal footer. `prefers-reduced-motion` handling and a systematic design-token/contrast audit beyond the high-contrast toggle above are also still open.

## 3. Routing table (`App.jsx`)

| Path | Component | Purpose |
|---|---|---|
| `/login` | `LoginScreen` | Real auth (§4) |
| `/` | `Dashboard` | Operational overview — real stats/donut/priority strip (§5) |
| `/model-1`, `/registry`, `/cameras`, `/cctv-registry` (aliases) | `Model1` → `CameraRegistry` | Model 1's mandatory registry — real (§5) |
| `/model-2` | `Model2` → `LiveCameras` | Camera grid + live SSE event feed — real (§5) |
| `/model-3` | `Model3` | **Deliberately not built** — see §5 |
| `/model-4` | `Model4` → `Analytics` | Analytics & Reports incl. real CSV export — real (§5) |
| `/investigation` | `Investigation` | Alert triage + real investigation + real map trace (§5) |
| `/watchlists` | `Watchlists` | Watchlist management — real (§4) |
| `/system` (new) | `SystemNetwork` | Pipeline health, adapter health, integration log — real (§5) |
| `/settings` | `Settings` → `Administration` | Users/roles, audit log, facial-recognition gate — real (§5) |
| `*` | → `/` | Fallback |

## 4. API integration (`src/api/client.js`) — rebuilt 2026-09-14

The client used to call `/api/intelligence/*` and `/api/operations/*` — endpoints that don't exist on the real backend (`server/`); those names only ever existed on a teammate's separately-evolving `contrib/aneesh/backend/`, which this project is **not** using as production (see backend.md's header and prd.md §15 — `server/` is production because it has the auth/RBAC/watchlist/alert/investigation work `contrib/aneesh/backend/` doesn't). The client is now wired against `server/`'s real routes:

- **Auth** — `login()`/`logout()`/`getCurrentUser()` against `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. The JWT is stored in `localStorage` and attached as `Authorization: Bearer` on every authenticated call. `LoginScreen.jsx` used to "succeed" for any non-empty username/password via a fake `setTimeout` — that was a real security bug (fake auth passing as real), not just an unfinished feature, and is fixed.
- **Route protection** — `api.hasSession()` covers a real token or a deliberate, honestly-labelled mock-mode login (when no backend is reachable at login time) — see `App.jsx`.
- **Cameras** — `GET/POST /api/cameras/`, gap-analysis, per-camera adapter health (`/api/cameras/{uid}/adapter/health` — note this is mounted under `/api/cameras`, not a separate `/api/adapters` prefix, a real mismatch the old client had).
- **Watchlists** — `GET/POST /api/watchlists/`. New in this pass — `Watchlists.jsx` is the first page built directly against this.
- **Alerts** — `GET /api/alerts/`, per-alert fetch, status PATCH, and opening an investigation from an alert (`POST /api/alerts/{uid}/investigation`).
- **Investigations** — full CRUD plus `timeline`, `trace` (the graded map-trace flow), and `evidence` sub-resources.
- **Live events** — `subscribeToLiveEvents()` opens a real `EventSource` against `GET /api/streams/events/stream` (deliberately unauthenticated on the backend, matching how browser `EventSource` can't send custom headers). Consumed by `Dashboard.jsx`'s "Live AI Events (this session)" counter and `LiveCameras.jsx`'s event feed.
- **Stream start/stop (new)** — `startStream()`/`stopStream()`/`getStreamStatus()` against real `POST/GET /api/streams/{camera_id}/[start|stop|status]`. `startStream()` spawns a real FFmpeg subprocess server-side (`server/video/ffmpeg_runner.py`) transcoding the camera's real `rtsp_url`; throws the backend's real error (e.g. "Camera not found or RTSP URL missing", or a 500 if ffmpeg genuinely isn't available) rather than a fabricated success.
- **AI detections** — still honestly mock-only (`getAIDetections()`): the real backend has no "list current detections" endpoint (`server/routers/ai.py` is per-frame `analyze-frame` only), so faking a live feed here would misrepresent what's actually running.
- **Admin** — `getUsers()`/`createUser()` (`/api/auth/users`), `getAuditLog()` (`/api/admin/audit-log` — unwraps its `{entries: [...]}` wrapper), `getFacialRecognitionStatus()`/`setFacialRecognitionAuthorization()` (`/api/admin/facial-recognition[/authorize]`). These three throw a real error on a non-2xx HTTP response (e.g. a genuine 403 for a non-admin account) rather than silently falling back to an empty list — a permission denial and "zero real rows" must never look the same to whoever's looking at the Administration page. Network-unreachable still falls back to mock, same as everywhere else.

Every method falls back to mock data (`src/api/mockData.js`) when the backend is unreachable, and `api.getMode()` reports which mode is active — this is what backs the Topbar's LIVE/MOCK pill, so the distinction is never silently hidden from the user (same honesty rule prd.md §0.1 requires for the submission demo).

## 5. Page-by-page status (honest checklist, mirrors backend.md §12's format)

**Wired to the real backend, verified end-to-end against a live in-process server** (not just "builds without errors" — a real smoke test ran camera creation → watchlist creation → a real alert-engine-generated alert → opening an investigation from it → fetching its real map trace, and confirmed every response shape matches what the client code expects):

- [x] Auth / route protection (§4) — `LoginScreen.jsx` used to "succeed" for any non-empty username/password via a fake `setTimeout`; that was a real security bug, now fixed.
- [x] `CameraRegistry.jsx` (Model 1, mandatory registry) — real `api.getCameras()`/`api.createCamera()`. The add-camera form was trimmed to only the fields the backend's `CameraCreate` schema actually stores (`type`/`resolution`/`power_source`/`warranty_status` were being silently discarded before, and a missing `rtsp_url` field was added back in the third pass — the field the backend actually stores and streaming now needs); the detail modal's Maintenance/History tabs, which used to show fabricated uptime percentages and invented service records as fallback data, now honestly say the backend doesn't track that yet instead of making something up. **Gap-analysis panel added in the third pass**: a real, threshold-adjustable table (District/Department/Current/Expected Minimum/Shortfall) against `api.getGapAnalysis()` and the real `GET /api/cameras/gap-analysis` endpoint — Model 1's spec requirement, previously computed by the backend but never surfaced anywhere in the UI.
- [x] `Dashboard.jsx` — stat cards, the department-activity donut, and the priority-response strip are computed from `api.getCameras()`/`api.getAlerts()`, not the fixed numbers (1428 cameras, 8742 "AI detections today", a hardcoded "GJ05X7821" incident) it shipped with. No real historical time-series endpoint exists, so the 7-day sparkline trend lines were dropped rather than fed a fabricated curve — `StatCard` only renders a `Sparkline` when real per-period data is actually supplied. "Live AI Events" counts real `subscribeToLiveEvents()` messages received this session (not a fabricated daily total, since no such endpoint exists — labeled accordingly, not as "Today"). `TelemetryTicker.jsx` was the same problem in miniature (7 hardcoded strings badged "LIVE" that never changed) — now derives its items from real camera/alert counts, with an honest single fallback item when there's nothing to report.
- [x] `Investigation.jsx` (Investigation & Alerts) — **the page that matters most**: prd.md §0.1's graded live technical test is exactly this page's alert → investigation → map-trace flow. Rebuilt against real `api.getAlerts()`, `api.createInvestigationFromAlert()`, and `api.getInvestigationTrace()` (server/intelligence/entity_graph.py's real cross-camera correlation). The fabricated "nearest patrol officer" (name, badge ID, ETA) and "AI forecast" predicted-next-location were dropped entirely — nothing on the real backend tracks officer location, so keeping that UI would mean permanently-fake data with no path to becoming real. The prediction-playback slider was repurposed into real trace playback: it steps through the actual chronological sightings the trace endpoint returns, flying the map to each one — same interaction pattern, now honest. Voice briefings (English/Hindi/Gujarati, Web Speech API) now speak real alert fields instead of a scripted fake incident. **Verified against a real seeded alert**: a real GPS-plotted marker, a real popup with the actual camera/timestamp, and working trace playback.
- [x] `LiveCameras.jsx` (`Model2.jsx`) — real camera grid (filterable by district/status/protocol) + a real live AI-event feed panel via `subscribeToLiveEvents()`. **Real HLS playback added in the third pass**: "Start Stream" calls real `api.startStream()`, and a genuine `hls.js`-backed `HlsPlayer.jsx` component attempts real playback of the returned URL. Verified end-to-end with a real camera + a configured (if unreachable) `rtsp_url`: the backend genuinely tried to spawn `ffprobe`, failed because this sandbox has no ffmpeg installed, returned a real 500, and the UI showed the real error ("Stream failed: Failed to start stream") with a Retry button — not a fabricated "connected" state. Given a real camera + a server host with ffmpeg installed, this plays real video.
- [x] Watchlists (`/watchlists`) — list, filter by category, add entry, real `match_count` from the backend.
- [x] `Analytics.jsx` (`Model4.jsx`) — real severity/type/district breakdowns from `api.getAlerts()`, and a **real CSV export** (entity, camera, district, confidence, timestamp) that is literally prd.md §0.1's "report showing detected vehicles/number plates with timestamps" submission deliverable, not a placeholder for one. No charting library is installed yet, so breakdowns are plain proportional bars over real counts rather than a new dependency pulled in for this pass.
- [x] `SystemNetwork.jsx` (new, `/system`) — 3 tabs, each honest about exactly what's real: **Pipeline Health** (real `GET /api/health/` — live CPU/memory from `psutil`, real `ffmpeg_available`/`ai_engine` flags, verified showing this sandbox's actual `ffmpeg_available: false`); **Adapter Health** (real `api.getAdapterHealth()` per selected camera, checked on demand — the endpoint genuinely opens a live connection, so it's never looped over the whole fleet automatically); **Integration Log** (honestly says no such endpoint exists on the backend yet, rather than fabricating rows — checked every router before building this page and confirmed there's genuinely nothing to show).
- [x] `Administration.jsx` (`Settings.jsx`) — Users & Roles (`/api/auth/users`, list + create), Audit Log (`/api/admin/audit-log`), and the DPDP-aware Facial Recognition authorization gate (`/api/admin/facial-recognition[/authorize]`, requires a stated reason to toggle either direction, matches backend.md §7's gate). All three are admin-only on the backend; verified a non-admin account gets a real 403, surfaced honestly in the UI rather than a silently-empty table.
- [x] `CameraMap.jsx` — **rewired in the third pass**, no longer a known gap. Was reading its own hardcoded `CAMERAS` array (a fixed "48 Nodes Online / 77.1% Coverage" regardless of the real registry) and showed a fabricated AI bounding-box overlay with a fake license plate ("VEHICLE [GJ-05-AB-7104] 98%"), a fake ticking "LIVE FEED" timestamp, a "Copy RTSP" button that copied a URL to a host that doesn't exist (`rtsp_url` is never exposed to the frontend, by design), and a "Snapshot" button with no real capture endpoint behind it. Now fetches real `api.getCameras()`, filters to cameras with real GPS coordinates (correctly plots nothing when none have coordinates yet, rather than fabricating positions), replaced the fake video overlay with an honest "No live playback in this environment" placeholder, replaced the two fake buttons with one real one (**Check Adapter Health**, calling the same real endpoint `SystemNetwork.jsx` uses) — verified via backend logs that clicking it genuinely opens a real RTSP connection attempt. Verified visually: the Dashboard's "Surveillance GIS Matrix" panel now shows "1 Registered Node" matching the real fleet, not a fixed 48.

**Deliberately not built:**
- [ ] `Model3.jsx` — not a gap, a decision. Its nav label ("VMS Federation") maps to the hackathon's Model 3 reference architecture, which this project's own integration-model decision explicitly rejects (backend.md §1). The page itself now says so, instead of an empty heading.

**Orphaned code removed:** `HomePage.jsx`/`HomePage.css` and `VariableCard.jsx`/`VariableCard.css` (a design-token showcase page, never referenced by `App.jsx`'s routes, referenced by nothing else) — deleted rather than left as unrouted dead code implying unfinished work.

## 6. What was worth porting from the archived Next.js app

**`contrib/nextjs-frontend-archive/` was removed from the repo on 2026-09-14** (prd.md §15) — its owner archived it externally rather than keeping a second copy in-tree. `client/` had already ported what it needed from it by that point: a real `AccessibilityBar.jsx` (§2) and a real live-event feed (`LiveCameras.jsx`, §5). Two pieces were identified at that time as worth porting later — both are now done natively in `client/`, not ported from the archive:
- A real WHEP/HLS player pattern — built natively as `HlsPlayer.jsx` (`hls.js`) wired into `LiveCameras.jsx`, calling the real `POST /api/streams/{id}/start` endpoint rather than reusing the archive's `LiveCameraPlayer.tsx`/`StreamHealthBadge.tsx` (§4, §5).
- Model 1's gap-analysis report UI — built natively as a panel in `CameraRegistry.jsx` against the existing `api.getGapAnalysis()` client method and the real `GET /api/cameras/gap-analysis` endpoint, rather than porting the archive's `GapAnalysisPanel.tsx` (§5).

## 7. Design system

No formal design-token system exists in `client/` yet (plain CSS per component, ad hoc colors). The archived Next.js app had one (institutional/government palette, contrast-verified tokens, typography scale) but the archive is no longer in-repo (§6) — not re-specified here to avoid describing a system the current code doesn't implement and a source that isn't checked out anywhere in this repo anymore.
