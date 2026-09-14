# G-VISTA — Frontend

Governs the client application: stack, routing/page inventory, and what's real vs. mock per page. Product scope, goals, personas, and the hackathon compliance context live in [prd.md](prd.md).

Stack: **React 19 + Vite 6**, `react-router-dom` for client-side routing, plain CSS per component (no CSS framework/tokens system yet), Leaflet/`react-leaflet` for mapping.

---

## 0. Why this doc was rewritten (2026-09-14)

This file used to describe a Next.js + TypeScript + Zustand app built earlier in this project. The team decided to standardize on a teammate's separately-developed React/Vite app instead (`client/`, previously `frontend/harsif/`) — it already had a working Camera Registry, Dashboard, and Investigation page with real design/UX investment, where the Next.js app had only Dashboard and Live Cameras built out. The Next.js app is archived at `contrib/nextjs-frontend-archive/` (decision log, prd.md §15) rather than deleted, in case anything in it is worth porting later (its Live Cameras page, its accessibility-bar implementation, and its Zustand stores are the most likely candidates — see §6 below).

**This doc now describes `client/` as it actually is**, not an aspirational spec. Where prd.md's page requirements (Model 1's registry/GIS, the graded vehicle-trace flow, etc.) aren't yet met by the current code, that's called out explicitly in §5 rather than glossed over — same honesty convention backend.md uses.

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
- **`Topbar.jsx`** — brand header, a pipeline-status indicator strip (currently a static "PIPELINES 1–5 ACTIVE" display, not backend-driven), a LIVE BACKEND/MOCK ENGINE pill (real — `api.checkBackendAvailability()`), a link to Investigation & Alerts, and the user/officer badge (real identity + working logout since §4's auth pass; shows "Demo session" when no backend is connected).
- **`Sidebar.jsx`** — left nav, 8 items (see §3's routing table).
- **`Layout.css`** — shared shell layout (app-shell, app-body, page-content).

**Not yet present** (all graded/required per prd.md's accessibility criteria, none built in `client/` yet): accessibility bar (skip-link, font-size stepper, EN/HI/GU language switch, high-contrast toggle), `prefers-reduced-motion` handling, and a systematic design-token/contrast pass. The archived Next.js app (`contrib/nextjs-frontend-archive/components/layout/AccessibilityBar.tsx`) already built this once — porting its behavior (not its React/CSS-module specifics) into a new `client/src/components/AccessibilityBar.jsx` is the fastest path to closing this gap, rather than designing it from zero.

## 3. Routing table (`App.jsx`)

| Path | Component | Purpose |
|---|---|---|
| `/login` | `LoginScreen` | Real auth (§4) |
| `/` | `Dashboard` | Operational overview |
| `/model-1`, `/registry`, `/cameras`, `/cctv-registry` (aliases) | `Model1` → `CameraRegistry` | Model 1's mandatory registry |
| `/model-2` | `Model2` | Stub — intended as Live Cameras/"Unified Viewing" (§5) |
| `/model-3` | `Model3` | Stub — **deliberately not built**, see §5 |
| `/model-4` | `Model4` | Stub — intended as Analytics & Reports (§5) |
| `/investigation` | `Investigation` | Case triage + map trace (§5) |
| `/watchlists` | `Watchlists` | Watchlist management — real (§4) |
| `/settings` | `Settings` | Stub — intended as Administration (§5) |
| `*` | → `/` | Fallback |

## 4. API integration (`src/api/client.js`) — rebuilt 2026-09-14

The client used to call `/api/intelligence/*` and `/api/operations/*` — endpoints that don't exist on the real backend (`server/`); those names only ever existed on a teammate's separately-evolving `contrib/aneesh/backend/`, which this project is **not** using as production (see backend.md's header and prd.md §15 — `server/` is production because it has the auth/RBAC/watchlist/alert/investigation work `contrib/aneesh/backend/` doesn't). The client is now wired against `server/`'s real routes:

- **Auth** — `login()`/`logout()`/`getCurrentUser()` against `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. The JWT is stored in `localStorage` and attached as `Authorization: Bearer` on every authenticated call. `LoginScreen.jsx` used to "succeed" for any non-empty username/password via a fake `setTimeout` — that was a real security bug (fake auth passing as real), not just an unfinished feature, and is fixed.
- **Route protection** — `api.hasSession()` covers a real token or a deliberate, honestly-labelled mock-mode login (when no backend is reachable at login time) — see `App.jsx`.
- **Cameras** — `GET/POST /api/cameras/`, gap-analysis, per-camera adapter health (`/api/cameras/{uid}/adapter/health` — note this is mounted under `/api/cameras`, not a separate `/api/adapters` prefix, a real mismatch the old client had).
- **Watchlists** — `GET/POST /api/watchlists/`. New in this pass — `Watchlists.jsx` is the first page built directly against this.
- **Alerts** — `GET /api/alerts/`, per-alert fetch, status PATCH, and opening an investigation from an alert (`POST /api/alerts/{uid}/investigation`).
- **Investigations** — full CRUD plus `timeline`, `trace` (the graded map-trace flow), and `evidence` sub-resources.
- **Live events** — `subscribeToLiveEvents()` opens a real `EventSource` against `GET /api/streams/events/stream` (deliberately unauthenticated on the backend, matching how browser `EventSource` can't send custom headers). Not yet consumed by any page — see §5.
- **AI detections** — still honestly mock-only (`getAIDetections()`): the real backend has no "list current detections" endpoint (`server/routers/ai.py` is per-frame `analyze-frame` only), so faking a live feed here would misrepresent what's actually running.

Every method falls back to mock data (`src/api/mockData.js`) when the backend is unreachable, and `api.getMode()` reports which mode is active — this is what backs the Topbar's LIVE/MOCK pill, so the distinction is never silently hidden from the user (same honesty rule prd.md §0.1 requires for the submission demo).

## 5. Page-by-page status (honest checklist, mirrors backend.md §12's format)

**Wired to the real backend:**
- [x] Auth / route protection (§4)
- [x] Watchlists (`/watchlists`) — list, filter by category, add entry, real `match_count` from the backend

**Built, but still using static/hardcoded data, not the API client at all** (not even the mock-fallback path — these bypass `src/api/client.js` entirely and import from `mockData.js`/`data/cameras.js` directly):
- [ ] `CameraRegistry.jsx` (Model 1) — real, polished UI (filters, add-camera modal, CSV import UI) but reads `MOCK_CAMERAS` directly. Wiring this to `api.getCameras()`/`api.createCamera()`/`api.importCamerasCSV()` is the single highest-value remaining item — it's Model 1's mandatory registry.
- [ ] `Dashboard.jsx` — reads `data/cameras.js` directly, not `api.getCameras()`.
- [ ] `Investigation.jsx` (Investigation & Alerts) — a fully-built, polished incident-response UI (multi-language voice briefings, live route playback, layer toggles) but its 4 incidents are hardcoded in the component, not fetched. **This is the page that matters most**: prd.md §0.1's graded live technical test is exactly this page's search → timeline → map-trace flow, and it must work against real data. Wiring `api.getAlerts()`/`api.getInvestigations()`/`api.getInvestigationTrace()` in here, replacing the hardcoded `incidents` array, is the top priority for the next pass.

**Not built at all (1-line stub components):**
- [ ] `Model2.jsx` — intended as Live Cameras (a camera grid + live detection feed, consuming `api.getCameras()` and `api.subscribeToLiveEvents()`). Nothing exists yet beyond a heading.
- [ ] `Model3.jsx` — **intentionally left as a stub, not a gap to fill.** Its nav label ("VMS Federation") maps to the hackathon's Model 3 reference architecture, which this project's own integration-model decision explicitly does not adopt (backend.md §1: "Model 3 ... would duplicate what the adapter factory already does and contradicts Model 2's 'no middleware' requirement"). Building real federation middleware here would contradict that decision. Recommend repurposing this nav slot for something the project actually needs and has no page for yet — System & Network (pipeline/adapter health, camera-fleet department-scoped view) is the natural fit — rather than building what the label currently implies.
- [ ] `Model4.jsx` — intended as Analytics & Reports (event volume, detections by category, watchlist-match trend, CSV/PDF export — prd.md §0.1's "report showing detected vehicles/plates with timestamps" submission deliverable lives here).
- [ ] `Settings.jsx` — intended as Administration (users & roles via `/api/auth/users`, audit log via `/api/admin/audit-log`, camera onboarding, AI/dataset config, the DPDP-aware facial-recognition privacy toggle via `/api/admin/facial-recognition`).

**Orphaned, not routed:**
- `HomePage.jsx` — not referenced anywhere in `App.jsx`'s routes. Either wire it in (as a pre-login marketing/landing page, if that's still wanted) or delete it — leaving unrouted code around invites confusion about what's actually live.

## 6. What's worth porting from the archived Next.js app (`contrib/nextjs-frontend-archive/`)

Not a rebuild — just naming the specific pieces that solved a problem `client/` hasn't solved yet, so nobody re-derives them from scratch:
- `components/layout/AccessibilityBar.tsx` — the accessibility bar `client/` is missing entirely (§2).
- `components/cameras/LiveCameraPlayer.tsx` + `components/cameras/StreamHealthBadge.tsx` — a real WHEP/HLS player pattern, relevant to `Model2.jsx`'s build-out.
- `lib/api/sse.ts` — an existing SSE-consumption pattern, relevant to wiring `api.subscribeToLiveEvents()` into a page.
- `components/dashboard/GapAnalysisPanel.tsx` — Model 1's gap-analysis report UI, which `client/`'s `CameraRegistry.jsx` doesn't have yet.

## 7. Design system

No formal design-token system exists in `client/` yet (plain CSS per component, ad hoc colors). The archived Next.js app's design system (institutional/government palette, contrast-verified tokens, typography scale) is documented in `contrib/nextjs-frontend-archive/` history if/when `client/` adopts a token system — not re-specified here to avoid describing a system the current code doesn't implement.
