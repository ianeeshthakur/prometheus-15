# Testing Strategy

## Testing Philosophy
For the MVP of G-VISTA, testing relies primarily on manual verification of critical paths (streaming, UI rendering) due to the rapid prototyping phase. Automated testing will be introduced in subsequent phases as the architecture solidifies.

## Test Stack
- **Frontend**: Currently unconfigured. Future: Playwright (E2E), Vitest (Unit).
- **Backend**: Currently unconfigured. Future: PyTest.

## Unit Testing
*Pending implementation.*

## Integration Testing
*Pending implementation.*

## End-to-End Testing
*Pending implementation.*

## API Testing
Use the automatically generated FastAPI Swagger UI (`http://localhost:8000/docs`) to test backend endpoints manually.

## Database Testing
*N/A*

## Mocking Strategy
- **Video Streams**: When testing the UI without a live RTSP feed, use public test streams or loop a local `.mp4` file through FFmpeg to simulate a camera feed.

## Test Data
*Pending implementation.*

## Test Naming Conventions
*Pending implementation.*

## Coverage Requirements
*None currently enforced.*

## Required Checks
Before considering a task complete, an AI coding agent or developer MUST verify:
1. `npm run build` succeeds without TypeScript errors.
2. The FastAPI backend starts without fatal errors.
3. The UI renders correctly in the browser without React hydration errors or console warnings.

## CI Testing
*No CI/CD pipeline is currently configured.*

## Definition of Done
A feature is done when:
- It meets the requirements in the PRD.
- It adheres to the styles in `globals.css` and `DESIGN.md`.
- It does not break existing video streaming functionality.
