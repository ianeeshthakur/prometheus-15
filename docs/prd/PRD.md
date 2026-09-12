# Product Requirements Document

## Product Overview
G-VISTA (Gujarat Video Intelligence & Surveillance Technology Architecture) is a statewide interoperable AI-driven video intelligence and investigation platform for the Gujarat Police. It integrates thousands of camera feeds (RTSP to HLS) into a centralized dashboard, providing real-time AI analytics, watchlist matching, and a dedicated investigation workspace.

## Target Users
*Assumptions based on system context:*
- **Control Room Operators:** Monitor live feeds, receive real-time alerts, and dispatch units.
- **Investigators/Detectives:** Search historical video data, trace vehicle routes (ANPR), and build case files.
- **Supervisors/Commanders:** View high-level metrics, system health, and overall threat intelligence.

## Problem Statement
*Assumptions based on system context:*
- The current surveillance infrastructure consists of siloed camera networks across different jurisdictions.
- Manual video review for investigations is extremely time-consuming and prone to human error.
- There is a lack of real-time automated alerting for known suspects or blacklisted vehicles.

## Goals
- Centralize access to 80,000+ CCTV cameras statewide.
- Provide low-latency video streaming (HLS) to a web-based dashboard.
- Automate detection of vehicles, license plates (ANPR), and persons of interest using AI.
- Enable fast searching of historical intelligence data.
- Provide a robust, user-friendly interface with real-time mapping.

## Non-Goals
- Hardware deployment and physical camera installation (this is a software-only platform scope).
- Complete replacement of existing local VMS (Video Management Systems) at the edge; focus is on integration.
- Long-term cold storage of raw video (only metadata and incident clips are prioritized).

## Core Features
- **Live Video Streaming:** RTSP ingestion converted to HLS via FFmpeg for web playback.
- **Interactive Map:** Leaflet-based map with camera clustering, live status indicators, and alerts.
- **AI Analytics Pipeline:** Real-time object detection overlays (bounding boxes for vehicles/persons).
- **Watchlist Matching:** Automated alerts when a recognized entity matches a predefined watchlist.
- **Telemetry Dashboard:** Live statistics, system health, and status badges.
- **Investigation Workspace:** Tools for tracing routes and viewing historical detection data.

## User Flows
- **Live Monitoring Flow:** Operator logs in -> Views map -> Clicks on camera cluster -> Selects camera -> Views live HLS stream with AI overlays -> Acknowledges incoming alerts.
- **Investigation Flow:** Investigator searches for vehicle plate -> System returns path history -> Investigator views map trace -> Reviews specific video snippets of the detections.

## Future Features
- **Facial Recognition:** Integration of real-time facial matching against criminal databases.
- **Anomaly Detection:** AI-driven alerts for unusual crowds, unattended baggage, or violence.
- **Mobile App:** A native mobile application for field officers to receive alerts and view nearby feeds.

## Technical Constraints
- The system must support high-throughput video ingestion without crashing.
- FFmpeg transcoding must be optimized to prevent backend resource exhaustion.
- Client-side must be performant enough to render multiple HLS streams and complex map clusters simultaneously.
- Must adhere to strict data privacy and retention regulations.

## Success Metrics
- **System Uptime:** > 99.9% availability for critical services.
- **Latency:** Glass-to-glass latency under 5 seconds for live streams.
- **Investigation Efficiency:** Significant reduction in time taken to trace a suspect vehicle across the state.
- **AI Accuracy:** High precision for ANPR and object detection under normal lighting conditions.

## Acceptance Criteria
- Users can view multiple concurrent live HLS streams on the dashboard without UI freezing.
- AI bounding boxes align correctly with the video stream in the frontend.
- System handles RTSP disconnections gracefully and attempts to reconnect.
- Map displays all registered cameras with their current online/offline status.
