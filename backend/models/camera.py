# Camera registry model -- the Model 1 (mandatory) registry, docs/backend.md §1/§5 Pipeline 1.
# Ported from contrib/aneesh/backend/models.py.
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from sqlalchemy.sql import func

from db.base import Base


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True)
    camera_uid = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    department = Column(String, nullable=False)
    district = Column(String, nullable=False)
    location = Column(String, nullable=False)
    # TODO (docs/backend.md §4): latitude/longitude are plain floats for now (SQLite).
    # Migrate to a PostGIS geometry(Point) column once on Postgres, for real spatial
    # queries backing the gap-analysis report and GIS map filters.
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    vms_vendor = Column(String, nullable=False)
    protocol_type = Column(String, nullable=False)  # RTSP, HLS, ONVIF, VENDOR_SDK
    status = Column(String, nullable=False)  # ACTIVE, INACTIVE, DEGRADED, OFFLINE
    ai_enabled = Column(Boolean, default=False)
    # Which AIOrchestrator profile runs against this camera's frames -- TRAFFIC,
    # SECURITY, or RTO (ai/schemas.py AIProfile). Backs the frontend.md §3.8 "AI &
    # datasets" per-camera profile selector; consumed by routers/streams.py's AI
    # pipeline. Fixed during docs/backend.md §12.3 cleanup -- previously every camera
    # was hardcoded to TRAFFIC.
    ai_profile = Column(String, nullable=False, default="TRAFFIC")
    # Which onboarding path created this row -- MANUAL, BULK_CSV, BULK_JSON, or
    # API_INGEST (the /api/ingest sync, docs/backend.md §2). Model 1's requirement
    # names all three onboarding paths explicitly; this is what lets the registry
    # actually report which one any given camera came through, closing a gap fixed
    # during docs/backend.md §12.5's cleanup.
    onboarding_source = Column(String, nullable=False, default="MANUAL")

    # Internal connection info, never exposed to frontend GET APIs directly
    # (see core/security.py -- CameraResponse simply omits this field).
    rtsp_url = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
