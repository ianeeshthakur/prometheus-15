# G-VISTA — Product Requirements Document

**Gujarat Video Intelligence & Surveillance Technology Architecture**
Status: Draft Rev B (fresh-start) · Supersedes all prior PRD/ARCHITECTURE drafts in `prometheus-1` · Last updated 2026-09-12

This is the single authoritative product document for the rebuild. It is written to be self-sufficient for frontend work specifically — every page, layout region, component, and state is specified here so no separate design conversation is required to start building. Visual tokens live in [DESIGN.md](DESIGN.md); this document defines *what exists on each screen and why*.

---

## 0. Context this PRD is written under

- This is a **government hackathon submission**. The product must visibly follow government digital-service norms, not consumer-SaaS or "hacker dashboard" conventions. The reference supplied is `india.gov.in`: light background, red/white/navy institutional palette, a visible accessibility toolbar (font size, language, screen reader, high contrast), a prominent search bar, and card-based service tiles over dense drawers.
- **Real data is coming, incrementally.** The team is actively collecting: (1) CCTV/RTSP video footage, (2) camera metadata (location/vendor/protocol), (3) vehicle/license-plate image datasets, and (4) anomaly/incident datasets (theft, loitering, wrong-way driving, crowd gathering, etc.) for training the anomaly detector. None of this exists yet at PRD-writing time — §8 defines an intake structure so each dataset has a home the moment it arrives, without blocking any other work.
- This PRD governs the fresh-start codebase at `github.com/ianeeshthakur/prometheus-15`, which already has the reconciled backend architecture scaffolded (see [ARCHITECTURE.md](ARCHITECTURE.md)). This document does not re-derive the backend; it summarizes it (§9) and spends its depth on product scope, information architecture, and the page-by-page frontend spec (§5), since that is the part with no separate source of truth yet.

---

## 1. Product overview

G-VISTA is a video-intelligence platform for Gujarat Police: it integrates existing, heterogeneous CCTV infrastructure (RTSP/HLS/ONVIF/vendor VMS) without requiring hardware replacement, runs AI analytics on the feeds (vehicle/person/plate detection, OCR, anomaly detection), correlates detections against watchlists, raises severity-scored alerts, and gives investigators a case-file workspace to trace an entity across cameras and build evidence.

Core loop: **Detect → Identify → Correlate → Trace → Alert → Investigate.**

## 2. Goals

- Give a control room a single, low-noise view of camera health and active incidents across districts.
- Turn raw detections into actionable, correctly-severity-scored alerts — never overwhelm the operator with raw AI output.
- Give a field investigator a coherent case-file workspace: one place to see everywhere an entity was seen, with evidence attached.
- Be demonstrably accessible and compliant with government digital-service norms (see §4) — this is graded, not optional polish.
- Be honest about mock vs. real: every screen must clearly indicate when it is showing simulated data vs. a live pipeline result.

## 3. Non-goals (v1)

- Facial recognition / biometric identification — gated behind an explicit authorization workflow if ever built, never a default (India's DPDP Act, 2023 and the Puttaswamy privacy judgment; see [security.md](../security/security.md)).
- A native mobile app. Web-responsive only; the command center must be usable on a tablet, not redesigned for it.
- Operating an actual 80,000-camera fleet. That number is the platform's design ceiling, not a pilot requirement — the pilot demonstrates correctness on however many real cameras/clips the collected dataset covers.
- PTZ camera control, two-way audio, edge NVR firmware integration.

## 4. Design mandate — government norms, non-negotiable

Because this is judged as a government product, the frontend must satisfy these constraints on every screen, not just the homepage:

1. **Light, institutional visual language by default.** No neon glow, no "cyberpunk," no dark-mode-only identity. Dark mode may exist as an explicit opt-in for night control-room use, but the product's default, judged identity is light and minimal, matching the india.gov.in reference.
2. **Visible accessibility controls**, always present in the header, never buried in a settings menu: font-size stepper (A− / A / A+), language switch (English / Hindi / Gujarati — labels only need to be wired for v1, full translation can follow), a high-contrast toggle, and a "skip to main content" link for keyboard/screen-reader users.
3. **WCAG 2.1 AA minimum**: 4.5:1 text contrast, every interactive element keyboard-reachable with a visible focus ring, no information conveyed by color alone (every status color is paired with an icon and a text label), all images/icons carry alt text or `aria-label`.
4. **Multi-page, not mega-dashboard.** Each distinct job (monitoring, triage, casework, reporting, admin) gets its own page with its own URL — no single screen tries to hold every function behind drawers and modals. §5 fixes the page count at **8**, deliberately fewer than earlier drafts (11), by merging pages that serve the same job.
5. **The 7 C's** — the content/interaction standard every page is checked against:

| C | Applied here as |
|---|---|
| **Clear** | Plain labels, no unexplained jargon or internal codenames in UI copy; icons always paired with text |
| **Concise** | No decorative content; every element on a page earns its place |
| **Concrete** | Real IDs, timestamps, counts, and confidence numbers shown — never vague language like "several alerts" |
| **Correct** | One source of truth per data point; a screen never shows two different numbers for the same fact |
| **Coherent** | Identical header/nav/breadcrumb/status-badge patterns across all 8 pages |
| **Complete** | A page answers the question that brought the user to it, without forcing a hunt across other pages |
| **Courteous** | Alerts inform, they don't panic — strong red/flashing reserved only for CRITICAL severity; error messages say what happened and what to do next |

## 5. Information architecture & page-by-page frontend specification

Eight top-level pages, each single-purpose. Every page shares the same shell (§5.0).

### 5.0 Shared shell (present on all 8 pages)

**Accessibility bar** (topmost strip, full width): skip-to-content link (visible on keyboard focus) · font-size stepper · language switch (EN/HI/GU) · high-contrast toggle · screen-reader mode indicator. Matches the india.gov.in reference row exactly in function.

**Header** (below accessibility bar): State emblem + "G-VISTA — Gujarat Police" wordmark (left) · global search (center — searches cameras, plates, case IDs, watchlist entries in one box) · notification bell with unread count · user profile menu · light/dark toggle (right).

**Left navigation** (persistent, collapsible to icon-only on narrow viewports): the 8 pages below, grouped as:
- **Monitor** — Dashboard, Live Cameras, Alerts
- **Intelligence** — Watchlists, Investigations, Analytics & Reports
- **Platform** — System & Network, Administration

**Footer status strip** (persistent, thin, bottom of viewport): backend connection state (Live / Reconnecting / Offline — text + icon, never color-only), last data sync time, DEMO/LIVE mode indicator (see §0 — this must always be visible so nobody mistakes simulated data for real).

---

### 5.1 Dashboard (`/`)

**Purpose:** one-glance operational picture for a control-room operator starting their shift.

**Layout:**
- Row 1 — four concrete metric cards: *Cameras Online / Total*, *Active Alerts* (split by severity count), *AI Events (last hour)*, *Open Investigations*. Each card: big number, label, small trend indicator, and a link to the relevant page.
- Row 2 — two-column, 70/30 split:
  - **Left**: Gujarat district map (light basemap, not a dark satellite look), camera markers clustered by district, colored by status (online/degraded/offline paired with icon shape, not color alone), click-to-zoom. Includes a **"View as list" toggle** that replaces the map with an equivalent sortable table for screen-reader/keyboard users — this is a hard accessibility requirement, not optional.
  - **Right**: Live alert feed, newest first, each row: severity badge, type, one-line description, camera + district, relative time, "View" link. Caps at 10 with a "View all alerts" link to `/alerts`.
- Row 3 — district health summary table: district name, cameras online/total, active alerts, last incident time. Sortable columns.

**States:** skeleton loaders on first load; explicit "No active alerts" empty state (not a blank space) when the feed is empty; a persistent banner if data is stale (backend disconnected), stating how long ago the last update was received.

---

### 5.2 Live Cameras (`/cameras`)

**Purpose:** watch feeds and review what the AI pipeline is currently detecting.

**Layout:**
- Filter bar: district, status, protocol (RTSP/HLS/ONVIF/Vendor), AI capability (ANPR/person/anomaly). Grid-density toggle (2/3/4 columns).
- Camera grid: each card shows a live thumbnail (or a clearly labeled placeholder if offline/mock), camera ID + location (monospace ID, plain-language location), status badge, AI-capability tags, and an "Open" action.
- Camera detail (opens as its own page state, not a stacked modal, to keep the URL shareable — `/cameras/[camera_uid]`): full player, detection overlay boxes (vehicle/person/plate, each a distinct shape+label, not color-only), a live event log for that camera (timestamped list of what the AI has detected), and adapter health (protocol, last heartbeat, FPS, restart count).

**States:** offline camera shows a neutral placeholder, a "No Signal" label, and the exact last-heartbeat timestamp (concrete, per the 7 C's) — never just a red box with no explanation.

---

### 5.3 Alerts (`/alerts`)

**Purpose:** the triage queue — the single place every alert, regardless of type, is worked from.

**Layout:** a table, not a card feed, for fast scanning: **Severity | Type | Entity | Camera / District | Time | Status | Actions**. Filter bar above: severity, status, district, date range, alert type. Row click opens a side panel (not a full page navigation, since triage is a rapid in-and-out flow): full description, evidence image if present, related events, and action buttons (Acknowledge, Escalate, Open Investigation, View Camera).

**7 C's check:** severity color is always paired with a text label (CRITICAL/HIGH/MEDIUM/LOW/INFO) and an icon; only CRITICAL uses a pulsing indicator — every other severity is static, so the interface doesn't cry wolf.

---

### 5.4 Watchlists (`/watchlists`)

**Purpose:** manage the lists the alert engine matches against.

**Layout:** tabs for category — Stolen Vehicles / Wanted & Missing Persons / Custom. Each tab: a table (identifier, description, risk level, source, added-by, match count, active toggle) plus an "Add entry" action opening a form, and a "Bulk import (CSV)" action. Clicking a match-count number jumps to the filtered alert history for that entry.

---

### 5.5 Investigations (`/investigations`, `/investigations/[id]`)

**Purpose:** case management **and** entity search — these are folded into one section because investigating *is* searching; a separate "Intelligence" page in the earlier draft was redundant with this one.

**List page (`/investigations`):** table of cases — ID, title, entity, status, priority, assigned officer, last updated. A prominent entity-search box at the top (search by plate, person description, or case ID) that can either open an existing case or start a new one from a match.

**Detail page (`/investigations/[id]`):** case header (title, status, priority, assigned officer, created/updated dates) with four tabs:
- **Timeline** — chronological event list, key events visually distinguished from routine sightings.
- **Evidence** — snapshots, clips, plate reads, event-log excerpts, each with a confidence value where applicable.
- **Related entities** — other vehicles/people/watchlist entries connected to this case, with the relationship stated in plain language ("seen with," "matched against"), not just a graph with no labels.
- **Map trace** — the entity's plotted route across cameras/time, with the same "view as list" accessible fallback as the Dashboard map.

---

### 5.6 Analytics & Reports (`/analytics`)

**Purpose:** district-command-level reporting — a different persona (ACP/DSP) and cadence (weekly/monthly) than the other pages, which is why it stays separate from Investigations rather than folded in.

**Layout:** date-range selector at top; charts below — event volume over time (by type), detections by category, district comparison, watchlist-match trend. Every chart has a paired data table (accessible alternative + lets an officer pull exact numbers, not just read a shape). An "Export" action produces CSV/PDF for offline reporting — a real government workflow need, not a nice-to-have.

---

### 5.7 System & Network (`/system`)

**Purpose:** merges the earlier drafts' separate "Camera Network" and "System Health" pages — both are "is the platform working" questions asked by the same admin persona.

**Layout:** three tabs:
- **Camera fleet** — list/map of every registered camera by protocol/vendor, with per-camera health %.
- **Pipeline health** — a status card per backend component (Video Ingestion, AI Orchestrator, Alert Engine, Database), each: state (Healthy/Degraded/Down, icon+label+color), last-checked time, and a one-line reason if not healthy.
- **Integration log** — recent connector errors (adapter failures, timeouts), newest first, with the camera and protocol involved.

---

### 5.8 Administration (`/admin`)

**Purpose:** merges the earlier drafts' separate "Security/Audit" and "Settings" pages — both are admin-only configuration/oversight, not operational monitoring.

**Layout:** four tabs:
- **Users & roles** — RBAC table (name, role, district scope, last login).
- **Audit log** — append-only, filterable log of every alert view/case action/config change, each entry showing who/what/when.
- **Camera onboarding** — add a camera manually, or bulk-import via CSV/JSON, with protocol configuration.
- **AI & datasets** — select the active AI profile (Traffic/Security/RTO) per camera, pin a model version, and see what's currently backing each detector (mock vs. a specific fine-tuned model version) — this is where §8's incoming datasets get wired in once they exist.

---

## 6. Personas

| Persona | Primary pages | Primary job |
|---|---|---|
| Control room operator | Dashboard, Live Cameras, Alerts | Monitor feeds, triage and escalate alerts |
| Field investigator | Investigations, Watchlists | Build a case, trace an entity, attach evidence |
| ACP / DSP (command) | Analytics & Reports, Dashboard | District oversight, periodic reporting |
| System administrator | System & Network, Administration | Camera onboarding, platform health, access control |

## 7. Design system

See [DESIGN.md](DESIGN.md) for the full token set (palette, type, spacing, components). Summary: light institutional theme, navy primary, saffron used sparingly as a secondary accent, semantic status colors always paired with icon+label, Noto Sans for UI text (chosen specifically because it renders Devanagari/Gujarati script, which English-only faces don't — relevant the moment the language switch in §5.0 is actually wired up), a monospace face for IDs/plates/timestamps.

## 8. Dataset strategy — incremental, real-data intake

No dataset exists yet at the time of writing; this section defines where each one lands the moment it's collected, so intake never blocks other work.

### 8.1 Categories being collected

| Category | Contents | Feeds |
|---|---|---|
| Video footage | Recorded or live RTSP/CCTV clips | Adapter testing (§9), AI orchestrator inference |
| Camera metadata | Real camera records: location, district, vendor, protocol | Camera registry (Pipeline 1) |
| Vehicle/plate images | Labeled images for ANPR | Plate detector + OCR fine-tuning |
| Anomaly/incident data | Labeled clips/images per incident type — theft, loitering, wrong-way driving, crowd gathering, unattended object, etc. | Anomaly detector fine-tuning |

### 8.2 Intake structure

A fixed folder contract so any dataset can be dropped in without a schema negotiation each time:

```
datasets/
  raw/
    video/            # <camera_uid>/<clip>.mp4 + a manifest.csv (camera_uid, timestamp, source, duration)
    camera_metadata/  # CSV/JSON exports of real camera records
    plates/           # images/ + labels.csv (image_id, plate_text, bbox)
    anomalies/        # one subfolder per anomaly_type (THEFT, LOITERING, WRONG_WAY, CROWD, ...), each with clips/images + labels.csv
  processed/          # normalized/cleaned outputs of the above, same subfolder shape
  splits/             # train/ val/ test/ manifests -- generated, never hand-edited
  DATASET_CARD.md      # one card per category: source, collection date, size, license, known limitations
```

`anomaly_type` stays an **open string, not a fixed enum** — new incident types get added as real data defines them, not guessed in advance (carried forward from the original anomaly-detection design decision).

### 8.3 Onboarding loop, per dataset as it arrives

1. Drop raw files under `datasets/raw/<category>/` per the structure above; write/update that category's `DATASET_CARD.md`.
2. Run the existing mock-provider pipeline against a sample to see where it currently fails on real data.
3. Label/correct using a human-in-the-loop tool (CVAT or Label Studio) rather than labeling from zero.
4. Fine-tune the relevant detector; version the dataset (DVC) and the run (MLflow/W&B) so results are reproducible.
5. Hold out a validation split before fine-tuning and never train on it; report the metric that matches the category (mAP@0.5 for detection, plate exact-match + character error rate for ANPR, precision/recall for anomaly alerts).
6. Update `/admin` → AI & datasets (§5.8) to point the relevant profile at the newly fine-tuned model version.

This loop runs independently per category — video footage arriving doesn't block wiring in an anomaly dataset later, and vice versa.

## 9. Backend summary (see ARCHITECTURE.md for full depth)

Already scaffolded in this repo: adapter-factory protocol normalization (RTSP/HLS real, ONVIF/Vendor-SDK stubbed), a profile-driven AI orchestrator (TRAFFIC/SECURITY/RTO) behind swappable mock detector interfaces, a DB-backed camera registry, and `backend/agents/` reserved for the Phase 2+ event-bus scale-out and the Phase 3+ LLM investigation copilot. This PRD does not change that architecture — §5's pages are the consumers of it.

## 10. Non-functional requirements

- Event-to-alert latency under 3 seconds once a real pipeline is running.
- Every page usable via keyboard alone, screen-reader-tested, WCAG 2.1 AA.
- Graceful degradation: if AI/alerting is down, camera playback keeps working; the footer status strip says so honestly rather than silently going stale.
- No credential or raw camera IP ever reaches the browser (carried forward unchanged from `RULES.md`).

## 11. Success metrics

| Dimension | What proves it |
|---|---|
| Government-norms compliance | Passes a WCAG 2.1 AA check; accessibility bar functions on every page |
| Real-data handling | At least one detector demonstrably fine-tuned on a dataset from §8, with a reported before/after metric |
| Information architecture discipline | Exactly 8 top-level pages, each satisfying its single stated purpose |
| Coherence | Identical shell (§5.0) verified present and consistent across all 8 pages |
| Investigator usefulness | A full entity trace (search → timeline → map → evidence) completable without leaving Investigations |

## 12. Open items

- Exact dataset contents/format — unknown until collection completes; §8's intake contract is deliberately format-flexible to absorb whatever arrives.
- Hindi/Gujarati translation content — the language switch is required in the UI (§4) for v1; full translated strings can follow.
- Event bus choice (Redis Streams vs. Kafka) for Phase 2 scale-out — not a frontend-blocking decision, deferred to ARCHITECTURE.md.
