# System Overview

**Status:** 🟢 IMPLEMENTED (Core Architecture)

G-VISTA is an intelligent video federation layer designed to unify heterogeneous CCTV infrastructure without requiring the replacement of existing hardware or Vendor Management Systems (VMS).

## The Interoperability Problem

Gujarat Police operations involve cameras from:
- Traffic departments (ANPR/Speed cameras).
- Municipal corporations (Smart City cameras).
- Private commercial entities (Malls, toll plazas).
- Legacy analog systems converted to IP.

These systems output different formats (RTSP, HLS), run on different vendor protocols (ONVIF, proprietary SDKs like Hikvision/Dahua), and isolate data in closed loops. 

## The G-VISTA Solution

G-VISTA solves this through a Pipeline-driven architecture:

1. **Pipeline 1 (Camera Registry)**: Catalogs all cameras securely, abstracting away their physical location and vendor.
2. **Pipeline 2 (Normalization)**: Dynamically connects to disparate streams and converts them into a universal `NormalizedFrame`.
3. **Pipeline 3 (AI Orchestration)**: Processes the normalized frames through modular AI detectors (Vehicles, Persons, Plates) to generate intelligence.
4. **Pipeline 4 & 5 (Intelligence & Investigation)**: *(⚪ PLANNED)* Correlates insights geographically and pushes them to human operators.

## Key Principles

1. **No Rip-and-Replace**: We integrate via existing network boundaries.
2. **Agnostic AI**: The AI layer does not care if a frame came from a £10,000 traffic camera or a £50 RTSP dome camera.
3. **Credential Security**: RTSP URLs and credentials never leave the backend servers.
