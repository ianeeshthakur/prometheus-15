# G-VISTA Design System

Government-institutional, light-first, accessible. This replaces the old "Glassy Control Room" dark/cyberpunk direction from `prometheus-1` entirely — that theme does not meet the norms this project is judged against (see [PRD.md §4](PRD.md#4-design-mandate--government-norms-non-negotiable)). Reference: `india.gov.in` (light background, red/white/navy institutional palette, visible accessibility toolbar, card-based service tiles).

## Principles

- **Institutional, not consumer.** No glow, no glassmorphism, no neon accents, no scan-line/animation flourishes. Flat surfaces, restrained shadows, clear borders.
- **Light by default.** Dark mode is an opt-in for night control-room use, not the product's identity.
- **Status is never color-only.** Every semantic color ships with an icon and a text label next to it.
- **Real numbers, monospace.** Any identifier, plate, timestamp, or count a user must read exactly (not skim) renders in the mono face.

## Color

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

## Typography

- **UI & body**: **Noto Sans** (400–700). Chosen specifically (not a generic default) because it has matching Devanagari and Gujarati subsets — required the moment the language switch in the header is actually wired to Hindi/Gujarati, unlike Inter/Helvetica-style faces which would silently fall back to a mismatched system font for those scripts.
- **Data/identifiers**: **JetBrains Mono** (400–600) — plate numbers, camera IDs, timestamps, coordinates.
- **Scale**: 12px (captions/labels) · 14px (body, table cells) · 16px (section headers) · 20px (page titles) · 28px (dashboard metric numbers, mono). Base body text is 14px, not 13px — this is a government-facing tool read by people, not a dense trader terminal; legibility over density.
- Uppercase is reserved for short labels/badges only (letter-spacing +0.04em), never for body copy or headings.

## Layout

- Accessibility bar: 32px tall, full width, `--bg-header`, top of viewport, above everything else including the header.
- Header: 56px tall.
- Left nav: 220px expanded / 64px icon-only collapsed — wide enough for full labels by default (accessibility: don't force icon-only as the norm).
- Footer status strip: 28px tall, persistent.
- Card radius: 8px. Button radius: 6px. Badge radius: 4px (pill for count badges only).
- Shadows: one elevation only — `0 1px 3px rgba(16,24,40,0.08)` for cards. No glow shadows, ever.
- Max content width on data-dense pages: none (use full width for tables/maps); on text-heavy admin forms: 720px for readability.

## Components

- **Badge** — icon + label + tint background at 12% opacity of the semantic color over a 1px border at 40% opacity. Never background-fill-only.
- **Button** — `.btn-primary` (navy fill, white text), `.btn-secondary` (white fill, navy border/text), `.btn-danger` (red border/text, white fill, red fill only on hover/press — a solid red button at rest reads as alarming, which violates the Courteous principle in PRD §4).
- **Card** — `--bg-surface`, 1px `--border`, 8px radius, no shadow unless elevated (e.g. an open dropdown/modal).
- **Table** — zebra-free (rely on borders, not alternating fill, for a calmer dense-data look), sortable column headers with a visible sort-direction icon, row hover uses `--bg-surface`.
- **Status dot/icon pairing** — every status ships as `[icon] [Label]`, e.g. a filled circle + "Online", a triangle + "Degraded", a slash-circle + "Offline". Shape differs per status, not just color, for colorblind users.
- **Map markers** — shape-coded by status (circle = online, triangle = degraded, square = offline), color reinforces but never carries the meaning alone. Every map has a "View as list" toggle producing an equivalent accessible table.
- **Accessibility bar controls** — font-size stepper (three fixed steps, persisted per session), language switch (EN/HI/GU, a real `<select>` or button group, not an icon-only flag toggle), high-contrast toggle (swaps to a pre-defined AAA-contrast palette variant, not just "more black"), skip-to-content link (visually hidden until keyboard-focused).

## Explicit "do not"

- No dark-mode-only design — every screen must be designed light-first.
- No neon glow, scan-line animation, or glassmorphism blur.
- No color-only status indication anywhere, including on the map.
- No decorative imagery/photography on operational screens (Dashboard, Cameras, Alerts, System, Admin) — photography is acceptable only if a future public-facing informational page is added, which is out of scope for v1.
- No auto-playing motion longer than a subtle 150–200ms transition; respect `prefers-reduced-motion`.
