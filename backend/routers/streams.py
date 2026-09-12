# Stream lifecycle + live AI-event SSE -- docs/backend.md §5 Pipeline 5.
#
# REWRITTEN during port (not a straight copy) from contrib/aneesh/backend/routers/streams.py:
# the source file imported `from ai.detection_service import detection_service, ocr_service`,
# a module that was never actually committed anywhere in the migration -- it would have
# raised ImportError on startup. This version wires the real ai/orchestrator.py
# (AIOrchestrator) and a real adapter (adapters/factory.py) instead, and reads via
# asyncio.to_thread since adapter.read_frame()/connect() are blocking OpenCV calls that
# must not block the event loop. The legacy in-memory camera_registry lookup is replaced
# with the DB-backed registry, consistent with adapters/factory.py's port.
#
# Default AI profile is TRAFFIC for every camera -- per-camera profile selection
# (docs/frontend.md §3.8 "AI & datasets" tab) is not wired yet; see docs/backend.md §12.
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from sse_starlette.sse import EventSourceResponse
import asyncio
import json
import logging

from db.database import SessionLocal
from services import camera_service
from video.stream_manager import stream_manager
from adapters.factory import AdapterFactory
from ai.orchestrator import AIOrchestrator
from ai.schemas import AIProfile
from intelligence.events import NormalizedEvent
from intelligence.alert_engine import alert_engine

logger = logging.getLogger(__name__)
router = APIRouter()

_orchestrators = {profile: AIOrchestrator(profile) for profile in AIProfile}


@router.post("/{camera_id}/start")
async def start_stream(camera_id: str, background_tasks: BackgroundTasks):
    db = SessionLocal()
    try:
        camera = camera_service.get_camera_by_uid(db, camera_id)
    finally:
        db.close()

    if not camera or not camera.rtsp_url:
        raise HTTPException(status_code=404, detail="Camera not found or RTSP URL missing")

    success = await stream_manager.start_stream(camera_id, camera.rtsp_url)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to start stream")

    if camera.ai_enabled:
        background_tasks.add_task(_run_ai_pipeline, camera_id)

    return {"status": "success", "message": "Stream started", "hls_url": f"/hls/{camera_id}/index.m3u8"}


@router.post("/{camera_id}/stop")
async def stop_stream(camera_id: str):
    await stream_manager.stop_stream(camera_id)
    return {"status": "success", "message": "Stream stopped"}


@router.get("/{camera_id}/status")
async def get_status(camera_id: str):
    status = stream_manager.get_stream_status(camera_id)
    if not status:
        return {"camera_id": camera_id, "status": "OFFLINE"}
    return status


async def _run_ai_pipeline(camera_id: str):
    """Runs the real AIOrchestrator against real adapter frames while the stream is LIVE."""
    logger.info(f"[{camera_id}] Starting AI pipeline")

    db = SessionLocal()
    try:
        camera = camera_service.get_camera_by_uid(db, camera_id)
        if not camera:
            logger.error(f"[{camera_id}] Camera disappeared before AI pipeline could start")
            return
        adapter = AdapterFactory.get_camera_adapter(camera_id, db)
    finally:
        db.close()

    orchestrator = _orchestrators[AIProfile.TRAFFIC]

    connected = await asyncio.to_thread(adapter.connect)
    if not connected:
        logger.error(f"[{camera_id}] AI pipeline adapter failed to connect")
        return

    try:
        while True:
            status = stream_manager.get_stream_status(camera_id)
            if not status or status.status != "LIVE":
                break

            frame = await asyncio.to_thread(adapter.read_frame)
            if frame is None:
                await asyncio.sleep(1)
                continue

            result = await asyncio.to_thread(orchestrator.analyze_frame, frame)

            for plate in result.plates:
                await alert_engine.process_event(
                    NormalizedEvent(
                        camera_id=camera_id,
                        event_type="PLATE_RECOGNIZED",
                        object_id=plate.vehicle_detection_id,
                        object_type="VEHICLE",
                        confidence=plate.final_confidence,
                        plate_number=plate.normalized_text if plate.status == "READABLE" else None,
                        location=camera.location,
                        district=camera.district,
                        attributes={"bbox": plate.bbox, "plate_status": plate.status},
                    )
                )

            for person in result.persons:
                await alert_engine.process_event(
                    NormalizedEvent(
                        camera_id=camera_id,
                        event_type="PERSON_DETECTED",
                        object_id=person.detection_id,
                        object_type="PERSON",
                        confidence=person.confidence,
                        location=camera.location,
                        district=camera.district,
                        attributes={"bbox": person.bbox},
                    )
                )

            for anomaly in result.anomalies:
                await alert_engine.process_event(
                    NormalizedEvent(
                        camera_id=camera_id,
                        event_type=f"ANOMALY_{anomaly.anomaly_type}",
                        object_type="ANOMALY",
                        confidence=anomaly.confidence,
                        location=camera.location,
                        district=camera.district,
                        attributes={"anomaly_type": anomaly.anomaly_type},
                    )
                )

            # docs/ai_pipelines.md §1 AI_TARGET_FPS=5 -- sample roughly that often, not
            # every available frame.
            await asyncio.sleep(1 / 5)
    finally:
        await asyncio.to_thread(adapter.close)
        logger.info(f"[{camera_id}] AI pipeline stopped")


@router.get("/events/stream")
async def events_stream(request: Request):
    """Server-Sent Events endpoint for live AI events."""
    queue = asyncio.Queue()
    alert_engine.subscribe(queue)

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                message = await queue.get()
                yield f"data: {json.dumps(message)}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            alert_engine.unsubscribe(queue)

    return EventSourceResponse(event_generator())
