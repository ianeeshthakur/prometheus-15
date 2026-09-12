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

# Instantiate orchestrators for demo purposes
orchestrators = {
    AIProfile.TRAFFIC: AIOrchestrator(AIProfile.TRAFFIC),
    AIProfile.SECURITY: AIOrchestrator(AIProfile.SECURITY),
    AIProfile.RTO: AIOrchestrator(AIProfile.RTO)
}

class FrameAnalyzeRequest(BaseModel):
    camera_uid: str
    profile: AIProfile = AIProfile.TRAFFIC
    width: int = 1920
    height: int = 1080
    source_protocol: str = "MOCK"

@router.get("/health")
async def ai_health() -> Dict[str, Any]:
    return {
        "status": "READY",
        "providers": {
            "vehicle": "MOCK_READY",
            "person": "MOCK_READY",
            "anomaly": "MOCK_READY",
            "plate": "MOCK_READY",
            "ocr": "MOCK_READY"
        }
    }

@router.get("/config")
async def ai_config() -> Dict[str, Any]:
    return {
        "profiles": AI_PROFILES_CONFIG,
        "active_orchestrators": list(orchestrators.keys())
    }

@router.post("/analyze-frame", response_model=AIAnalysisResult)
async def analyze_frame(request: FrameAnalyzeRequest):
    """
    Test endpoint for pipeline 3.
    Accepts metadata and generates a dummy numpy array to simulate NormalizedFrame.
    """
    if request.profile not in orchestrators:
        raise HTTPException(status_code=400, detail="Invalid profile")

    orchestrator = orchestrators[request.profile]

    # Create dummy frame representing a valid image for testing
    # Use random noise to ensure high Laplacian variance (so quality analyzer returns GOOD)
    dummy_frame = np.random.randint(0, 255, (request.height, request.width, 3), dtype=np.uint8)

    norm_frame = NormalizedFrame(
        camera_uid=request.camera_uid,
        frame=dummy_frame,
        timestamp=datetime.now(),
        width=request.width,
        height=request.height,
        source_protocol=request.source_protocol,
        frame_sequence=1
    )

    return orchestrator.analyze_frame(norm_frame)
