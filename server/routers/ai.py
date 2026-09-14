# AI orchestrator test/config endpoints -- docs/backend.md §5 Pipeline 3. Ported
# verbatim from contrib/aneesh/backend/routers/ai.py.
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
from datetime import datetime
import numpy as np

from ai.schemas import AIProfile, AIAnalysisResult
from ai.config import AI_PROFILES_CONFIG
from ai.orchestrator import AIOrchestrator
from adapters.models import NormalizedFrame

router = APIRouter()

# Instantiated once per profile for the process lifetime (demo scale -- fine for now).
orchestrators = {
    AIProfile.TRAFFIC: AIOrchestrator(AIProfile.TRAFFIC),
    AIProfile.SECURITY: AIOrchestrator(AIProfile.SECURITY),
    AIProfile.RTO: AIOrchestrator(AIProfile.RTO),
}


class FrameAnalyzeRequest(BaseModel):
    camera_uid: str
    profile: AIProfile = AIProfile.TRAFFIC
    width: int = 1920
    height: int = 1080
    source_protocol: str = "MOCK"


@router.get("/health")
async def ai_health() -> Dict[str, Any]:
    # Dynamically check real providers from the orchestrator
    traffic_orch = orchestrators[AIProfile.TRAFFIC]
    is_real = getattr(traffic_orch.plate_detector, "configured", False)
    plate_status = "REAL" if is_real else "MOCK_READY"
    
    # In this current setup, only plate is truly REAL if configured.
    return {
        "status": "READY",
        "providers": {
            "vehicle": "MOCK_READY",
            "person": "MOCK_READY",
            "anomaly": "MOCK_READY",
            "plate": plate_status,
            "ocr": "MOCK_READY",
        },
    }


@router.get("/config")
async def ai_config() -> Dict[str, Any]:
    return {"profiles": AI_PROFILES_CONFIG, "active_orchestrators": list(orchestrators.keys())}


@router.post("/analyze-frame", response_model=AIAnalysisResult)
async def analyze_frame(request: FrameAnalyzeRequest):
    """Test endpoint for Pipeline 3. Accepts metadata and generates a dummy numpy array
    to simulate a NormalizedFrame -- exercises the orchestrator without a real camera."""
    if request.profile not in orchestrators:
        raise HTTPException(status_code=400, detail="Invalid profile")

    orchestrator = orchestrators[request.profile]

    # Random noise (not a blank frame) so the Laplacian-variance quality check returns GOOD.
    dummy_frame = np.random.randint(0, 255, (request.height, request.width, 3), dtype=np.uint8)

    norm_frame = NormalizedFrame(
        camera_uid=request.camera_uid,
        frame=dummy_frame,
        timestamp=datetime.now(),
        width=request.width,
        height=request.height,
        source_protocol=request.source_protocol,
        frame_sequence=1,
    )

    return orchestrator.analyze_frame(norm_frame)
