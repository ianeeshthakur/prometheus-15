# System health endpoint -- docs/frontend.md §3.7 Pipeline health tab. Ported verbatim
# from contrib/aneesh/backend/routers/health.py.
from fastapi import APIRouter
import psutil
import shutil

router = APIRouter()


@router.get("/")
async def get_health():
    """Returns system and AI health."""
    ffmpeg_installed = shutil.which("ffmpeg") is not None

    return {
        "status": "online",
        "cpu_percent": psutil.cpu_percent(),
        "memory_percent": psutil.virtual_memory().percent,
        "ffmpeg_available": ffmpeg_installed,
        "ai_engine": "simulated",
        "gpu_available": False,
    }
