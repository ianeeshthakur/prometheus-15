from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from sse_starlette.sse import EventSourceResponse
from typing import Dict, Any
import asyncio
import json
import logging

from video.stream_manager import stream_manager
from db import get_db
from sqlalchemy.orm import Session
from fastapi import Depends
import services.camera_service as camera_service
# from intelligence.events import NormalizedEvent
# from intelligence.alert_engine import alert_engine

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/{camera_id}/start")
async def start_stream(camera_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    cam = camera_service.get_camera_by_uid(db, camera_id)
    if not cam or not cam.rtsp_url:
        raise HTTPException(status_code=404, detail="Camera not found or RTSP URL missing")
    rtsp_url = cam.rtsp_url
        
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
    logger.info(f"Started AI pipeline simulation for {camera_id}")
    pass

@router.get("/events/stream")
async def events_stream(request: Request):
    return {"message": "Stream moved to new intelligence API"}
