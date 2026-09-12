# Design System

## Design Philosophy
G-VISTA uses a modern, data-heavy, cyberpunk-inspired visual language suitable for law enforcement and surveillance control rooms. The interface is primarily dark mode-centric to reduce eye strain in dimly lit control environments, featuring glassmorphism and high-contrast semantic indicators.

## Visual Direction
- **Theme**: "Glassy Control Room"
- **Mode**: Primarily Dark Mode (with a Light Mode fallback).
- **Aesthetic**: Clean, technical, authoritative.

## Colors
Derived directly from `globals.css` CSS variables:

### Backgrounds
- **Primary**: `#080c12` (Dark) / `#f8fafc` (Light)
- **Secondary**: `#0d1219` (Dark) / `#f1f5f9` (Light)
- **Panel/Surface**: `#111827` / `#161e2e` (Dark) with glass effects.

### Accents
- **Cyan**: `#0ea5e9` (Main brand color and interaction highlight)
- **Blue**: `#1d4ed8` / `#3b82f6`

### Semantic Status
- **Online (Good)**: `#10b981` (Emerald)
- **Warning (Moderate)**: `#f59e0b` (Amber)
- **Critical (High/Danger)**: `#ef4444` (Red)
- **Offline (Unknown/Low)**: `#6b7280` (Gray)
- **Info (Medium)**: `#8b5cf6` (Purple)

### Text
- **Primary**: `#f0f4f8` (Dark mode text)
- **Secondary**: `#94a3b8`
- **Muted**: `#475569`

## Typography
- **Primary Font**: `Inter` (Sans-serif) for all general UI, navigation, and reading text.
- **Data/Monospace Font**: `JetBrains Mono` or `Fira Code` for telemetry, numbers, IDs, and technical data points.
- **Sizes**: Standard text is small (`13px`) to maximize data density.

## Spacing
- Compact spacing. Panels and grids are tightly packed to show maximum information.

## Border Radius
- **Standard UI Elements**: `8px` (`.glass-panel`)
- **Buttons**: `6px` (`.btn`)
- **Small Badges**: `4px` (`.badge`)

## Shadows
- Elevated shadow: `0 10px 15px -3px rgba(0, 0, 0, 0.5)` for dark mode depth.
- Accent shadows: Neon-like glows (e.g., `box-shadow: 0 0 10px rgba(14, 165, 233, 0.1)`).

## Layout
- **App Shell**: A full-screen flex layout (`100vh`) with no overall page scrolling.
- **Sidebar**: Fixed width `72px`.
- **Top Bar**: Fixed height `52px`.
- **Content Area**: Flexible, internally scrolling panels.

## Responsive Breakpoints
- Standard Tailwind breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`).
- The dashboard is primarily designed for desktop/large screens (`lg` and above).

## Component Patterns

### Panels
- Use `.glass-panel` for standard containers.
- Use `.glass-panel-elevated` for modals or popovers.
- Use `.glass-panel-accent` to highlight an active or selected container.

### Buttons
- `.btn`: Base class.
- `.btn-primary`: Cyan background, black text.
- `.btn-danger`: Red translucent background.
- `.btn-ghost`: Transparent background, borderless.

### Badges
- High-contrast, uppercase, small text (`.badge-online`, `.badge-critical`, etc.).

### Navigation
- Sidebar uses `.sidebar-item` with an `.active` state that displays a cyan vertical indicator bar.

### Maps
- Custom Leaflet overrides: Dark map background, custom zoom controls styled to match the dark theme, and custom popup wrappers.
- Custom Map Markers: `.cluster-marker` with a blur effect, turning red and pulsing (`.has-alert`) when critical.

### Video Feeds
- `.camera-feed` class features a scan-line animation overlay to simulate a technical surveillance feed.

## Animations
- **Critical Pulse**: `.animate-pulse-critical` (flashing red dots for high-severity alerts).
- **Scan Line**: `.animate-scan-line` for video feeds.
- **Transitions**: Smooth slide-ins (`.animate-slide-in-right`) and fade-ins (`.animate-fade-in`).

## Accessibility
- Maintain high contrast for critical alerts.
- Do not rely solely on color; use icons (Lucide-react) to indicate state.

## Do Not
- Do not introduce rounded, friendly "Web 2.0" styles.
- Do not use large, airy padding typical of consumer landing pages.
- Do not use arbitrary colors outside the defined semantic status palette.
