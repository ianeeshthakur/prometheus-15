# Adapter health diagnostic endpoint -- docs/backend.md §5 Pipeline 2. Ported from
# contrib/aneesh/backend/routers/adapters.py, import paths adapted.
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from db.database import get_db
from adapters.factory import AdapterFactory

router = APIRouter()


class AdapterHealthResponse(BaseModel):
    camera_uid: str
    status: str
    dimensions: str


@router.get("/{camera_uid}/adapter/health", response_model=AdapterHealthResponse)
async def check_adapter_health(camera_uid: str, db: Session = Depends(get_db)):
    """Diagnostic endpoint for Pipeline 2 adapter connections. Strictly returns
    metadata -- never exposes rtsp_url or credentials."""
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
                status = adapter.health_check()

        return AdapterHealthResponse(camera_uid=camera_uid, status=status, dimensions=dimensions)
    finally:
        # Must aggressively close to avoid leaking OpenCV/FFmpeg resources.
        adapter.close()
