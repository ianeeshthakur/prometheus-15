from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from db import get_db
from adapters.factory import AdapterFactory

router = APIRouter()

class AdapterHealthResponse(BaseModel):
    camera_uid: str
    status: str
    dimensions: str

@router.get("/{camera_uid}/adapter/health", response_model=AdapterHealthResponse)
async def check_adapter_health(camera_uid: str, db: Session = Depends(get_db)):
    """
    Diagnostic endpoint to test Pipeline #2 adapter connection.
    Strictly returns metadata. Never exposes rtsp_url or credentials.
    """
    try:
        adapter = AdapterFactory.get_camera_adapter(camera_uid, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    try:
        connected = adapter.connect()
        status = adapter.health_check()

        dimensions = "Unknown"
        if connected:
            frame = adapter.read_frame()
            if frame:
                dimensions = f"{frame.width}x{frame.height}"
                status = adapter.health_check() # refresh status after read

        return AdapterHealthResponse(
            camera_uid=camera_uid,
            status=status,
            dimensions=dimensions
        )
    finally:
        # We must aggressively close to avoid leaking OpenCV/FFmpeg resources
        adapter.close()
