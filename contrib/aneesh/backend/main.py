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

    # Initialize DB (creates SQLite db file and tables if not exist)
    try:
        import models # ensure models are registered
        Base.metadata.create_all(bind=engine)
        logger.info("Database initialized successfully.")
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

# Create FastAPI app
app = FastAPI(
    title="G-VISTA Live Mode Backend",
    description="Backend service for handling RTSP streaming and AI event normalization",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for HLS streaming
# The frontend will request /hls/{camera_id}/index.m3u8
hls_dir = os.environ.get("HLS_OUTPUT_DIR", "/tmp/gvista-hls")
os.makedirs(hls_dir, exist_ok=True)
app.mount("/hls", StaticFiles(directory=hls_dir), name="hls")

# Include routers
app.include_router(streams.router, prefix="/api/streams", tags=["streams"])
app.include_router(cameras.router, prefix="/api/cameras", tags=["cameras"])
app.include_router(adapters.router, prefix="/api/cameras", tags=["adapters"])
app.include_router(health.router, prefix="/api/health", tags=["health"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])

@app.get("/")
async def root():
    return {"message": "G-VISTA Live Mode Backend API is running"}
