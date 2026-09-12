# Pipeline 4 — Intelligence & Correlation

**Status:** ⚪ PLANNED

## Purpose
Pipeline 4 serves as the analytical brain of G-VISTA. While Pipeline 3 asks *"What objects are in this frame?"*, Pipeline 4 asks *"Who do these objects belong to, and why should we care?"*

It ingests the `AIAnalysisResult` and correlates it against external state and national databases.

## Planned Data Flow

```mermaid
graph TD
    AI[Pipeline 3 AIAnalysisResult]
    
    subgraph Pipeline 4
        Event[Event Store / PostGIS]
        
        subgraph Lookups
            V[VAHAN / RTO]
            E[eGujCop Watchlist]
            S[Stolen Vehicles DB]
        end
        
        subgraph Correlation
            GIS[Geospatial Tracker]
            Match[Identity Matcher]
        end
    end
    
    P5[Pipeline 5 Alerts]

    AI --> Event
    Event --> Match
    Match <--> V
    Match <--> E
    Match <--> S
    Event --> GIS
    Match --> P5
    GIS --> P5
```

## Core Functions

1. **VAHAN / RTO Integration**: Convert the normalized OCR plate text into vehicle ownership details, registration status, and challan history.
2. **Watchlist Matching**: Compare recognized faces or number plates against active BOLO (Be On the Lookout) or stolen vehicle lists from eGujCop.
3. **GIS / Spatiotemporal Correlation**: Track a `camera_uid`'s physical coordinates to plot a vehicle's path across multiple districts over time.

## Database Transition
This pipeline necessitates the move from the current lightweight SQLite prototype to a robust PostgreSQL + PostGIS cluster, allowing for complex geographic radius queries and massive event-time series indexing.
