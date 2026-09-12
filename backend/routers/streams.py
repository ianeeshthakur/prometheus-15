from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from sse_starlette.sse import EventSourceResponse
from typing import Dict, Any
import asyncio
import json
import logging

from video.stream_manager import stream_manager
from integration.camera_registry import camera_registry
from ai.detection_service import detection_service, ocr_service
from intelligence.events import NormalizedEvent
from intelligence.alert_engine import alert_engine

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/{camera_id}/start")
async def start_stream(camera_id: str, background_tasks: BackgroundTasks):
    rtsp_url = camera_registry.get_rtsp_url(camera_id)
    if not rtsp_url:
        raise HTTPException(status_code=404, detail="Camera not found or RTSP URL missing")

    success = await stream_manager.start_stream(camera_id, rtsp_url)

    if success:
        # Start AI simulation task in background
        background_tasks.add_task(simulate_ai_pipeline, camera_id)
        return {"status": "success", "message": "Stream started", "hls_url": f"/hls/{camera_id}/index.m3u8"}
    else:
        raise HTTPException(status_code=500, detail="Failed to start stream")

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

async def simulate_ai_pipeline(camera_id: str):
    """
    Simulates the AI pipeline running on the extracted frames.
    In reality, FFmpeg would output frames, YOLO processes them, etc.
    """
    logger.info(f"Started AI pipeline simulation for {camera_id}")
    cam_info = next((c for c in camera_registry.get_all() if c["id"] == camera_id), None)

    while stream_manager.get_stream_status(camera_id) and stream_manager.get_stream_status(camera_id).status == "LIVE":
        await asyncio.sleep(2) # Process every 2 seconds

        # Simulate frame extraction
        fake_frame = b"fake_image_data"

        # 1. Detection
        detections = await detection_service.detect_frame(camera_id, fake_frame)

        for det in detections:
            # 2. OCR if vehicle
            plate = None
            if det["type"] == "VEHICLE":
                ocr_result = await ocr_service.read_plate(fake_frame)
                if ocr_result:
                    plate = ocr_result["text"]

            # 3. Create normalized event
            event = NormalizedEvent(
                camera_id=camera_id,
                event_type="VEHICLE_DETECTED" if det["type"] == "VEHICLE" else "OBJECT_DETECTED",
                object_type=det["type"],
                confidence=det["confidence"],
                plate_number=plate,
                location=cam_info["location"] if cam_info else "Unknown",
                district=cam_info["district"] if cam_info else "Unknown",
                attributes={"bbox": det["bbox"]}
            )

            # 4. Send to Alert Engine
            await alert_engine.process_event(event)

@router.get("/events/stream")
async def events_stream(request: Request):
    """Server-Sent Events endpoint for live AI events."""
    queue = asyncio.Queue()
    alert_engine.subscribe(queue)

    async def event_generator():
        try:
            while True:
                # If client closes connection, stop generator
                if await request.is_disconnected():
                    break

                # Wait for next event
                message = await queue.get()
                yield f"data: {json.dumps(message)}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            alert_engine.unsubscribe(queue)

    return EventSourceResponse(event_generator())
