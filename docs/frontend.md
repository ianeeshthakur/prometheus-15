# G-VISTA — Frontend

Governs every UI/UX decision: design system, information architecture, page-by-page spec, and local frontend setup. Product scope, goals, personas, and the hackathon compliance context live in [prd.md](prd.md) — this file is the "how it looks and is built," prd.md is the "what and why."

Stack: **Next.js (App Router) + TypeScript**, Zustand for client state (chosen over Context/Redux — see prd.md §15 decision log), Leaflet for mapping.

---

## 1. Design system

Government-institutional, light-first, accessible. Replaces the old "Glassy Control Room" dark/cyberpunk direction from `prometheus-1` entirely — that theme does not meet the norms this project is judged against (prd.md §4). Reference: `india.gov.in` (light background, red/white/navy institutional palette, visible accessibility toolbar, card-based service tiles) — independently confirmed by the hackathon's own portal at `sentinel.gujarat.gov.in`, which ships the same pattern (font-size stepper, high-contrast toggle, dyslexia font, audio page reading).

### Principles

- **Institutional, not consumer.** No glow, no glassmorphism, no neon accents, no scan-line/animation flourishes. Flat surfaces, restrained shadows, clear borders.
- **Light by default.** Dark mode is an opt-in for night control-room use, not the product's identity.
- **Status is never color-only.** Every semantic color ships with an icon and a text label next to it.
- **Real numbers, monospace.** Any identifier, plate, timestamp, or count a user must read exactly (not skim) renders in the mono face.

### Color

| Token | Light value | Dark value (opt-in) | Use |
|---|---|---|---|
| `--bg-primary` | `#FFFFFF` | `#0F172A` | Page background |
| `--bg-surface` | `#F4F6F8` | `#1A2436` | Cards, panels |
| `--bg-header` | `#FFFFFF` | `#111C2E` | Header/nav background |
| `--border` | `#D7DCE1` | `rgba(255,255,255,.12)` | Dividers, card borders |
| `--primary` | `#1B3A6B` (institutional navy) | `#5B8DEF` | Brand, primary buttons, active nav, links |
| `--accent` | `#FF9933` (saffron, used sparingly) | `#FFB05C` | Highlights, badges of note — never as a large fill |
| `--status-critical` | `#C62828` | `#F26A6A` | Critical severity only |
| `--status-warning` | `#B8860B` (amber, darkened for AA contrast on white) | `#E8B84B` | High/degraded |
| `--status-online` | `#1B8A5A` | `#4CC38A` | Healthy/online/match-confirmed |
| `--status-info` | `#5B6472` | `#94A3B8` | Medium/informational |
| `--text-primary` | `#1A2330` | `#F1F5F9` | Body/heading text |
| `--text-secondary` | `#5B6472` | `#A9B4C0` | Supporting text, labels |
| `--focus-ring` | `#1B3A6B` at 3px, 2px offset | `#5B8DEF` at 3px | Every focusable element, no exceptions |

Contrast requirement: every text/background pairing above must hold **4.5:1** minimum (AA). Verify `--status-warning` and `--accent` specifically against white — they are the two most likely to fail if adjusted later.

### Typography

- **UI & body**: **Noto Sans** (400–700). Chosen specifically (not a generic default) because it has matching Devanagari and Gujarati subsets — required the moment the language switch in the header is actually wired to Hindi/Gujarati, unlike Inter/Helvetica-style faces which would silently fall back to a mismatched system font for those scripts.
- **Data/identifiers**: **JetBrains Mono** (400–600) — plate numbers, camera IDs, timestamps, coordinates.
- **Scale**: 12px (captions/labels) · 14px (body, table cells) · 16px (section headers) · 20px (page titles) · 28px (dashboard metric numbers, mono). Base body text is 14px, not 13px — this is a government-facing tool read by people, not a dense trader terminal; legibility over density.
- Uppercase is reserved for short labels/badges only (letter-spacing +0.04em), never for body copy or headings.

### Layout

- Accessibility bar: 32px tall, full width, `--bg-header`, top of viewport, above everything else including the header.
- Header: 56px tall.
- Left nav: 220px expanded / 64px icon-only collapsed — wide enough for full labels by default (accessibility: don't force icon-only as the norm).
- Footer status strip: 28px tall, persistent.
- Card radius: 8px. Button radius: 6px. Badge radius: 4px (pill for count badges only).
- Shadows: one elevation only — `0 1px 3px rgba(16,24,40,0.08)` for cards. No glow shadows, ever.
- Max content width on data-dense pages: none (use full width for tables/maps); on text-heavy admin forms: 720px for readability.

### Components

- **Badge** — icon + label + tint background at 12% opacity of the semantic color over a 1px border at 40% opacity. Never background-fill-only.
- **Button** — `.btn-primary` (navy fill, white text), `.btn-secondary` (white fill, navy border/text), `.btn-danger` (red border/text, white fill, red fill only on hover/press — a solid red button at rest reads as alarming, which violates the Courteous principle, §2 below).
- **Card** — `--bg-surface`, 1px `--border`, 8px radius, no shadow unless elevated (e.g. an open dropdown/modal).
- **Table** — zebra-free (rely on borders, not alternating fill, for a calmer dense-data look), sortable column headers with a visible sort-direction icon, row hover uses `--bg-surface`.
- **Status dot/icon pairing** — every status ships as `[icon] [Label]`, e.g. a filled circle + "Online", a triangle + "Degraded", a slash-circle + "Offline". Shape differs per status, not just color, for colorblind users.
- **Map markers** — shape-coded by status (circle = online, triangle = degraded, square = offline), color reinforces but never carries the meaning alone. Every map has a "View as list" toggle producing an equivalent accessible table.
- **Accessibility bar controls** — font-size stepper (three fixed steps, persisted per session), language switch (EN/HI/GU, a real `<select>` or button group, not an icon-only flag toggle), high-contrast toggle (swaps to a pre-defined AAA-contrast palette variant, not just "more black"), skip-to-content link (visually hidden until keyboard-focused).

### Explicit "do not"

- No dark-mode-only design — every screen must be designed light-first.
- No neon glow, scan-line animation, or glassmorphism blur.
- No color-only status indication anywhere, including on the map.
- No decorative imagery/photography on operational screens (Dashboard, Cameras, Alerts, System, Admin) — photography is acceptable only if a future public-facing informational page is added, which is out of scope for v1.
- No auto-playing motion longer than a subtle 150–200ms transition; respect `prefers-reduced-motion`.

## 2. The 7 C's — content/interaction standard every page is checked against

| C | Applied here as |
|---|---|
| **Clear** | Plain labels, no unexplained jargon or internal codenames in UI copy; icons always paired with text |
| **Concise** | No decorative content; every element on a page earns its place |
| **Concrete** | Real IDs, timestamps, counts, and confidence numbers shown — never vague language like "several alerts" |
| **Correct** | One source of truth per data point; a screen never shows two different numbers for the same fact |
| **Coherent** | Identical header/nav/breadcrumb/status-badge patterns across all 8 pages |
| **Complete** | A page answers the question that brought the user to it, without forcing a hunt across other pages |
| **Courteous** | Alerts inform, they don't panic — strong red/flashing reserved only for CRITICAL severity; error messages say what happened and what to do next |

## 3. Information architecture

Eight top-level pages, each single-purpose, fixed deliberately at 8 (not the earlier draft's 11) by merging pages that serve the same job. Every page shares the shared shell (§3.0). This structure also satisfies the hackathon's mandatory **Model 1** registry/GIS requirement (prd.md §0.1) without adding a 9th page — see §3.1 and §3.7 below.

### 3.0 Shared shell (present on all 8 pages)

**Accessibility bar** (topmost strip, full width): skip-to-content link (visible on keyboard focus) · font-size stepper · language switch (EN/HI/GU) · high-contrast toggle · screen-reader mode indicator. Matches the india.gov.in / sentinel.gujarat.gov.in reference row in function.

**Header** (below accessibility bar): State emblem + "G-VISTA — Gujarat Police" wordmark (left) · global search (center — searches cameras, plates, case IDs, watchlist entries in one box) · notification bell with unread count · user profile menu · light/dark toggle (right).

**Left navigation** (persistent, collapsible to icon-only on narrow viewports): the 8 pages below, grouped as:
- **Monitor** — Dashboard, Live Cameras, Alerts
- **Intelligence** — Watchlists, Investigations, Analytics & Reports
- **Platform** — System & Network, Administration

**Footer status strip** (persistent, thin, bottom of viewport): backend connection state (Live / Reconnecting / Offline — text + icon, never color-only), last data sync time, DEMO/LIVE mode indicator (this must always be visible so nobody mistakes simulated data for real — protects against the hackathon's "no mock-ups accepted" rule by making mock vs. real state impossible to misread, including by judges).

---

### 3.1 Dashboard (`/`)

**Purpose:** one-glance operational picture for a control-room operator starting their shift.

**Layout:**
- Row 1 — four concrete metric cards: *Cameras Online / Total*, *Active Alerts* (split by severity count), *AI Events (last hour)*, *Open Investigations*. Each card: big number, label, small trend indicator, and a link to the relevant page.
- Row 2 — two-column, 70/30 split:
  - **Left**: Gujarat district map (light basemap, not a dark satellite look), camera markers clustered by district, colored by status (online/degraded/offline paired with icon shape, not color alone), click-to-zoom. Includes a **"View as list" toggle** that replaces the map with an equivalent sortable table for screen-reader/keyboard users — this is a hard accessibility requirement, not optional.
  - **Right**: Live alert feed, newest first, each row: severity badge, type, one-line description, camera + district, relative time, "View" link. Caps at 10 with a "View all alerts" link to `/alerts`.
- Row 3 — district health summary table: district name, cameras online/total, active alerts, last incident time. Sortable columns.
- Row 4 (**Model 1 requirement**) — coverage **gap-analysis** summary: districts/departments with camera density below a configurable threshold, rendered as a small ranked list with a "View full gap report" link into §3.7's Camera fleet tab (which holds the detailed report). This is the graded "gap-analysis report" deliverable — it must exist, not just be implied by the map.

**States:** skeleton loaders on first load; explicit "No active alerts" empty state (not a blank space) when the feed is empty; a persistent banner if data is stale (backend disconnected), stating how long ago the last update was received.

---

### 3.2 Live Cameras (`/cameras`)

**Purpose:** watch feeds and review what the AI pipeline is currently detecting.

**Layout:**
- Filter bar: district, status, protocol (RTSP/HLS/ONVIF/Vendor), AI capability (ANPR/person/anomaly). Grid-density toggle (2/3/4 columns).
- Camera grid: each card shows a live thumbnail (or a clearly labeled placeholder if offline/mock), camera ID + location (monospace ID, plain-language location), status badge, AI-capability tags, and an "Open" action.
- Camera detail (opens as its own page state, not a stacked modal, to keep the URL shareable — `/cameras/[camera_uid]`): full player, detection overlay boxes (vehicle/person/plate, each a distinct shape+label, not color-only), a live event log for that camera (timestamped list of what the AI has detected), and adapter health (protocol, last heartbeat, FPS, restart count).

**States:** offline camera shows a neutral placeholder, a "No Signal" label, and the exact last-heartbeat timestamp (concrete, per the 7 C's) — never just a red box with no explanation.

**Player note:** the live player should target **WHEP (WebRTC)** first for low-latency browser preview against the real ingest API, falling back to **HLS** on restricted networks — see backend.md §2 for the exact stream URLs. Never proxy raw RTSP into the browser.

**Map tiles:** use standard OpenStreetMap raster tiles (`{s}.tile.openstreetmap.org`) — CARTO's free Positron/light_all tiles now require an API key and render an "API key required" watermark without one. Plain OSM tiles are still light/neutral (not dark/satellite), so they satisfy §1's basemap requirement with no key and no cost. Revisit only if OSM's usage policy becomes a problem at demo scale.

---

### 3.3 Alerts (`/alerts`)

**Purpose:** the triage queue — the single place every alert, regardless of type, is worked from.

**Layout:** a table, not a card feed, for fast scanning: **Severity | Type | Entity | Camera / District | Time | Status | Actions**. Filter bar above: severity, status, district, date range, alert type. Row click opens a side panel (not a full page navigation, since triage is a rapid in-and-out flow): full description, evidence image if present, related events, and action buttons (Acknowledge, Escalate, Open Investigation, View Camera).

**7 C's check:** severity color is always paired with a text label (CRITICAL/HIGH/MEDIUM/LOW/INFO) and an icon; only CRITICAL uses a pulsing indicator — every other severity is static, so the interface doesn't cry wolf.

---

### 3.4 Watchlists (`/watchlists`)

**Purpose:** manage the lists the alert engine matches against.

**Layout:** tabs for category — Stolen Vehicles / Wanted & Missing Persons / Custom. Each tab: a table (identifier, description, risk level, source, added-by, match count, active toggle) plus an "Add entry" action opening a form, and a "Bulk import (CSV)" action. Clicking a match-count number jumps to the filtered alert history for that entry.

---

### 3.5 Investigations (`/investigations`, `/investigations/[id]`)

**Purpose:** case management **and** entity search — these are folded into one section because investigating *is* searching; a separate "Intelligence" page in the earlier draft was redundant with this one.

**Graded requirement:** the hackathon's live technical test gives a vehicle number on hackathon day and requires tracing it across the real camera network with a timestamped, location-wise route. This page's search → timeline → map flow **is** that test — it must work end-to-end against the real ingest API, not only mock data.

**List page (`/investigations`):** table of cases — ID, title, entity, status, priority, assigned officer, last updated. A prominent entity-search box at the top (search by plate, person description, or case ID) that can either open an existing case or start a new one from a match.

**Detail page (`/investigations/[id]`):** case header (title, status, priority, assigned officer, created/updated dates) with four tabs:
- **Timeline** — chronological event list, key events visually distinguished from routine sightings.
- **Evidence** — snapshots, clips, plate reads, event-log excerpts, each with a confidence value where applicable.
- **Related entities** — other vehicles/people/watchlist entries connected to this case, with the relationship stated in plain language ("seen with," "matched against"), not just a graph with no labels.
- **Map trace** — the entity's plotted route across cameras/time, with the same "view as list" accessible fallback as the Dashboard map.

---

### 3.6 Analytics & Reports (`/analytics`)

**Purpose:** district-command-level reporting — a different persona (ACP/DSP) and cadence (weekly/monthly) than the other pages, which is why it stays separate from Investigations rather than folded in.

**Layout:** date-range selector at top; charts below — event volume over time (by type), detections by category, district comparison, watchlist-match trend. Every chart has a paired data table (accessible alternative + lets an officer pull exact numbers, not just read a shape). An "Export" action produces CSV/PDF for offline reporting.

**Graded requirement:** the hackathon's live-feed demo must produce "a report showing detected vehicles/number plates with timestamps" — build this export as the real feature here, not a manually-assembled slide. It doubles as a submission deliverable (prd.md §14) and a genuine product feature (prd.md §13.2 differentiator).

---

### 3.7 System & Network (`/system`)

**Purpose:** merges the earlier drafts' separate "Camera Network" and "System Health" pages — both are "is the platform working" questions asked by the same admin persona.

**Layout:** three tabs:
- **Camera fleet** (this is where **Model 1's registry** lives) — list/map of every registered camera, filterable by **department** (Police/Health/GSRTC/Panchayat/Municipal/RTO/...), protocol/vendor, and district, each row showing per-camera health %, onboarding source (bulk/manual/API), and analog-vs-IP. Includes **role-based search** (an admin sees every department; a department-scoped user sees only theirs) and the full **gap-analysis report**: a coverage table/heatmap by district × department showing camera-density shortfalls, exportable, and linked from the Dashboard's Row 4 summary.
- **Pipeline health** — a status card per backend component (Video Ingestion, AI Orchestrator, Alert Engine, Database), each: state (Healthy/Degraded/Down, icon+label+color), last-checked time, and a one-line reason if not healthy.
- **Integration log** — recent connector errors (adapter failures, timeouts), newest first, with the camera and protocol involved.

---

### 3.8 Administration (`/admin`)

**Purpose:** merges the earlier drafts' separate "Security/Audit" and "Settings" pages — both are admin-only configuration/oversight, not operational monitoring.

**Layout:** four tabs:
- **Users & roles** — RBAC table (name, role, district scope, last login).
- **Audit log** — append-only, filterable log of every alert view/case action/config change, each entry showing who/what/when.
- **Camera onboarding** (Model 1's onboarding requirement) — add a camera manually, bulk-import via CSV/JSON, **or register via the `/api/ingest` catalogue endpoint** (backend.md §2) — all three onboarding paths must exist since the hackathon FAQ names all three explicitly, with protocol configuration and department assignment per camera.
- **AI & datasets** — select the active AI profile (Traffic/Security/RTO) per camera, pin a model version, and see what's currently backing each detector (mock vs. a specific fine-tuned model version) — see ai_pipelines.md §4 for the dataset intake this wires into, and a visible DPDP-aware privacy toggle gating facial-recognition-style features (see backend.md §5 security).

---

## 4. Local frontend setup

```
npm install
cp .env.example .env      # sets NEXT_PUBLIC_APP_MODE, NEXT_PUBLIC_BACKEND_URL
npm run dev                # next dev, defaults to http://localhost:3000
```

Runs against the backend at `NEXT_PUBLIC_BACKEND_URL` (default `http://localhost:8000` — see backend.md §6 to start it). `NEXT_PUBLIC_APP_MODE` controls the DEMO/LIVE indicator in the footer status strip (§3.0) — keep it honest; this is a graded distinction, not cosmetic (prd.md §0.1). `package.json` dependencies are not yet pinned (Next.js, React, Zustand, Leaflet, and a charting library for §3.6 still need adding) — see checklist below.

## 5. Frontend feature checklist

Everything below is currently a 1-line placeholder file/component in the repo — nothing is implemented yet. Check items off as they land; keep this list current rather than aspirational.

**Shell & cross-cutting**
- [x] Accessibility bar (skip-link, font-size stepper, EN/HI/GU switch, high-contrast toggle) — §3.0
- [x] Header (emblem, wordmark, global search, notifications, profile, theme toggle) — §3.0
- [x] Left nav (collapsible, 3 groups, 8 pages) — §3.0
- [x] Footer status strip (connection state, last sync, DEMO/LIVE indicator) — §3.0, honestly reports "Not connected" until a real backend exists
- [x] Design tokens wired into `app/globals.css` (plain CSS custom properties, no Tailwind) from §1
- [x] Noto Sans + JetBrains Mono loaded via `next/font/google` and applied per §1 typography scale
- [x] `prefers-reduced-motion` respected globally; CRITICAL-only badge pulse animation added

**Pages**
- [x] Dashboard fully built incl. gap-analysis Row 4, Leaflet map with view-as-list fallback, live alert feed, sortable district table (§3.1) — seeded from `lib/mock-data.ts`, DEMO mode only
- [x] Live Cameras + camera detail (§3.2) — filter bar, grid-density toggle, camera cards, `/cameras/[camera_uid]` detail with adapter health + per-camera event log. Player is honest about DEMO mode (no fake video) with illustrative detection overlays; **real WHEP/HLS playback against backend.md §2's ingest API is not wired up yet** — frontend has nothing to connect to until that exists
- [ ] Alerts triage table + side panel (§3.3) — placeholder page in place, not yet built
- [ ] Watchlists (3 tabs + CSV import) (§3.4) — placeholder page in place, not yet built
- [ ] Investigations list + detail (4 tabs) incl. working map-trace against real data (§3.5) — placeholder pages in place, not yet built
- [ ] Analytics & Reports incl. real CSV/PDF export (§3.6) — placeholder page in place, not yet built
- [ ] System & Network (3 tabs incl. Model 1 registry/gap-analysis/role-based search) (§3.7) — placeholder page in place, not yet built
- [ ] Administration (4 tabs incl. all 3 onboarding paths + privacy toggle) (§3.8) — placeholder page in place, not yet built

**Accessibility (judged directly, prd.md §11)**
- [ ] WCAG 2.1 AA contrast verified for every token pairing, especially `--status-warning`/`--accent` on white — tokens are wired but not yet audited
- [x] Every interactive element keyboard-reachable with visible focus ring (global `:focus-visible` rule)
- [x] Map "view as list" accessible fallback on Dashboard — not yet on Investigations map-trace (page not built)
- [ ] Screen-reader pass on all 8 pages
