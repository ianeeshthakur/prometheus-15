import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database initialization
from db import engine, Base

# Import routers
from routers import streams, cameras, health, adapters, ai
from routers import intelligence as intelligence_router
from routers import operations as operations_router

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger("gvista-backend")


# Define lifespan manager to handle startup and shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    logger.info("Starting G-VISTA Live Mode Backend")

    # Initialize DB
    # Import all SQLAlchemy models so their tables are registered
    try:
        import models
        import intelligence.models
        import operations.models

        Base.metadata.create_all(bind=engine)
        logger.info("Database initialized successfully.")
        
        # Bootstrap Sentinel Live Camera if configured
        from db import SessionLocal
        with SessionLocal() as db:
            _bootstrap_sentinel_camera(db)

    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")

    # Make sure HLS output directory exists
    hls_dir = os.environ.get("HLS_OUTPUT_DIR", "/tmp/gvista-hls")
    os.makedirs(hls_dir, exist_ok=True)

    logger.info(f"HLS Output Directory: {hls_dir}")

    yield

    # Shutdown logic
    logger.info("Shutting down G-VISTA backend")

    # Clean up any running FFmpeg processes
    from video.stream_manager import stream_manager

    stream_manager.stop_all()


def _bootstrap_sentinel_camera(db):
    mode = os.environ.get("MODE", "DEMO")
    if mode != "LIVE":
        return

    username = os.environ.get("SENTINEL_RTSP_USERNAME")
    password = os.environ.get("SENTINEL_RTSP_PASSWORD")
    host = os.environ.get("SENTINEL_HOST")
    port = os.environ.get("SENTINEL_PORT")
    path = os.environ.get("SENTINEL_PATH")

    if not all([username, password, host, port, path]):
        logger.warning("Sentinel LIVE configuration is incomplete. Sentinel camera will not be automatically registered.")
        return
        
    rtsp_url = f"rtsp://{username}:{password}@{host}:{port}/{path}"

    import schemas
    import services.camera_service as camera_service

    cam_in = schemas.CameraCreate(
        camera_uid="CAM-GJ-SRT-00421",
        name="Surat Ring Road Entry",
        department="Legacy",
        district="Surat",
        location="Surat Ring Road",
        vms_vendor="Sentinel",
        protocol_type="RTSP",
        status="ACTIVE",
        ai_enabled=True,
        rtsp_url=rtsp_url
    )
    
    try:
        cam, created = camera_service.upsert_camera(db, cam_in)
        if created:
            logger.info(f"Bootstrapped Sentinel camera {cam.camera_uid} into registry.")
        else:
            logger.info(f"Updated Sentinel camera {cam.camera_uid} configuration in registry.")
    except Exception as e:
        logger.error(f"Failed to bootstrap Sentinel camera: {e}")


# Create FastAPI app
app = FastAPI(
    title="G-VISTA Live Mode Backend",
    description="Backend service for handling RTSP streaming and AI event normalization",
    version="1.0.0",
    lifespan=lifespan,
)


# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Mount static files for HLS streaming
# The frontend will request /hls/{camera_id}/index.m3u8
hls_dir = os.environ.get("HLS_OUTPUT_DIR", "/tmp/gvista-hls")
os.makedirs(hls_dir, exist_ok=True)

app.mount(
    "/hls",
    StaticFiles(directory=hls_dir),
    name="hls",
)


# ============================================================
# Include API Routers
# ============================================================

# Pipeline 1 / 2 / existing streaming routes
app.include_router(
    streams.router,
    prefix="/api/streams",
    tags=["streams"],
)

app.include_router(
    cameras.router,
    prefix="/api/cameras",
    tags=["cameras"],
)

app.include_router(
    adapters.router,
    prefix="/api/cameras",
    tags=["adapters"],
)

app.include_router(
    health.router,
    prefix="/api/health",
    tags=["health"],
)

# Pipeline 3 - AI Video Analytics
app.include_router(
    ai.router,
    prefix="/api/ai",
    tags=["ai"],
)

# Pipeline 4 - Intelligence & Correlation
app.include_router(
    intelligence_router.router,
    prefix="/api/intelligence",
    tags=["intelligence"],
)

# Pipeline 5 - Operational Response & Investigation
app.include_router(
    operations_router.router,
    prefix="/api/operations",
    tags=["operations"],
)


# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "G-VISTA Live Mode Backend API is running"
    }