from fastapi import APIRouter
import psutil
import shutil

router = APIRouter()

@router.get("/")
async def get_health():
    """Returns system and AI health."""

    # Check if FFmpeg is available
    ffmpeg_installed = shutil.which("ffmpeg") is not None

    return {
        "status": "online",
        "cpu_percent": psutil.cpu_percent(),
        "memory_percent": psutil.virtual_memory().percent,
        "ffmpeg_available": ffmpeg_installed,
        "ai_engine": "simulated",
        "gpu_available": False
    }
