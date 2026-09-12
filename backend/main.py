# G-VISTA backend entrypoint. Ported from contrib/aneesh/backend/main.py, adapted to
# the models/ + schemas/ + db/ package layout and core/ config module, then extended
# during the docs/backend.md §12.4 build-out with auth/RBAC, alerts, and investigations.
# See docs/backend.md §12 for what's still missing.
import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import CORS_ORIGINS, HLS_OUTPUT_DIR, ADMIN_BOOTSTRAP_USERNAME, ADMIN_BOOTSTRAP_PASSWORD
from core.logging import configure_logging
from db.base import Base
from db.database import engine, SessionLocal

configure_logging()
logger = logging.getLogger("gvista-backend")

from routers import (  # noqa: E402 (after logging config)
    streams,
    cameras,
    health,
    adapters,
    ai,
    watchlists,
    auth,
    alerts,
    investigations,
    admin,
)


def _bootstrap_admin_user():
    """Creates the first ADMIN account if the users table is empty -- there is no
    other way to log in on a fresh DB. See core/config.py for the (loudly obvious)
    default credentials; override via env before any real deployment."""
    import services.user_service as user_service
    from schemas.user import UserCreate

    db = SessionLocal()
    try:
        if not user_service.list_users(db):
            user_service.create_user(
                db,
                UserCreate(username=ADMIN_BOOTSTRAP_USERNAME, password=ADMIN_BOOTSTRAP_PASSWORD, role="ADMIN"),
            )
            logger.warning(
                f"Bootstrapped admin user '{ADMIN_BOOTSTRAP_USERNAME}' with the default password -- "
                "change it (or set ADMIN_BOOTSTRAP_PASSWORD before first startup) before any real use."
            )
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting G-VISTA backend")

    try:
        # noqa: F401 -- these imports ensure every model is registered on Base before create_all
        import models.camera  # noqa: F401
        import models.watchlist  # noqa: F401
        import models.user  # noqa: F401
        import models.event  # noqa: F401
        import models.alert  # noqa: F401
        import models.investigation  # noqa: F401
        import models.admin_settings  # noqa: F401
        Base.metadata.create_all(bind=engine)
        logger.info("Database initialized successfully.")
        _bootstrap_admin_user()
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
app.include_router(watchlists.router, prefix="/api/watchlists", tags=["watchlists"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(investigations.router, prefix="/api/investigations", tags=["investigations"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])


@app.get("/")
async def root():
    return {"message": "G-VISTA backend is running"}
