# Project Memory

## Current Status
- Initial project scaffolding is complete.
- The Next.js 15 App Router frontend is set up with the "G-VISTA" cyberpunk/dark mode design system (`globals.css`).
- Layout components (`AppShell`, `Sidebar`, `TopBar`) are implemented.
- The Python FastAPI backend is initialized with basic routers and a stream manager concept for FFmpeg.
- Core dependencies (Leaflet, HLS.js, Recharts, Zustand) are installed.

## Recently Completed
- Established the AI agent documentation suite (PRD, AGENTS, DESIGN, ARCHITECTURE, RULES, DECISIONS, TESTING).
- Bootstrapped Next.js frontend with Tailwind v4.
- Bootstrapped FastAPI backend.

## Currently In Progress
- Integrating the HLS.js video player component with the backend FFmpeg static output.
- Building out the interactive Leaflet map with custom cluster markers.

## Known Problems
- FFmpeg subprocess management needs careful handling to prevent zombie processes when the backend restarts.
- RTSP ingestion from public test URLs can be unstable; error handling in the UI for dead streams needs refinement.

## Important Context
- The system uses a specialized color palette defined in `globals.css`. Always use these variables for UI elements.
- The architecture requires the backend to act as a transcoding proxy (RTSP -> HLS).

## Recent Decisions
- Chose **HLS** over WebRTC for video streaming due to simpler architectural requirements and better compatibility with static file serving, accepting the slight latency tradeoff.
- Chose **Zustand** for frontend state management to avoid React Context re-render issues with high-frequency telemetry data.

## Next Steps
- Implement the `LiveCameraPlayer` component to consume the generated HLS playlists.
- Implement the AI overlay logic (bounding boxes) on top of the video player.
- Flesh out the backend intelligence routes.

## Things to Be Careful About
- **Memory Leaks**: `hls.js` instances must be strictly destroyed on React component unmount.
- **CPU Spikes**: Multiple concurrent FFmpeg processes on the backend will quickly exhaust resources. Implement limits or mock streams during development.

## Session Handoff
If starting a new session:
1. Review `AGENTS.md` and `RULES.md`.
2. Check `globals.css` for the design system.
3. Start the frontend (`npm run dev`) and backend (`python -m uvicorn main:app --reload`) to observe the current UI state.
