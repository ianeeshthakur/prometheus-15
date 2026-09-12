# G-VISTA backend entrypoint. Ported from contrib/aneesh/backend/main.py, adapted to
# the models/ + schemas/ + db/ package layout and core/ config module. Only routers
# that are actually implemented are included below -- see docs/backend.md §12 for what's
# still missing (auth, alerts, investigations, watchlists routers all remain 1-line
# placeholders and are deliberately NOT wired in here yet, since including an
# unimplemented router would break startup).
import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import CORS_ORIGINS, HLS_OUTPUT_DIR
from core.logging import configure_logging
from db.base import Base
from db.database import engine

configure_logging()
logger = logging.getLogger("gvista-backend")

from routers import streams, cameras, health, adapters, ai  # noqa: E402 (after logging config)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting G-VISTA backend")

    try:
        import models.camera  # noqa: F401 -- ensures the model is registered on Base before create_all
        Base.metadata.create_all(bind=engine)
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")

    os.makedirs(HLS_OUTPUT_DIR, exist_ok=True)
    logger.info(f"HLS Output Directory: {HLS_OUTPUT_DIR}")

    yield

    logger.info("Shutting down G-VISTA backend")
    from video.stream_manager import stream_manager
    stream_manager.stop_all()


app = FastAPI(
    title="G-VISTA Backend",
    description="Gujarat video-intelligence platform backend -- camera registry, protocol adapters, AI orchestrator.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Local RTSP->HLS transcoding output (video/ffmpeg_runner.py) -- for real cameras that
# only speak RTSP. The hackathon's own simulated feeds already provide HLS/WHEP URLs
# directly (docs/backend.md §2) and don't need this.
os.makedirs(HLS_OUTPUT_DIR, exist_ok=True)
app.mount("/hls", StaticFiles(directory=HLS_OUTPUT_DIR), name="hls")

app.include_router(cameras.router, prefix="/api/cameras", tags=["cameras"])
app.include_router(adapters.router, prefix="/api/cameras", tags=["adapters"])
app.include_router(streams.router, prefix="/api/streams", tags=["streams"])
app.include_router(health.router, prefix="/api/health", tags=["health"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])


@app.get("/")
async def root():
    return {"message": "G-VISTA backend is running"}
