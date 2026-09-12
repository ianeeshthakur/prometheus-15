from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from sqlalchemy.sql import func
from db import Base

class Camera(Base):
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True)
    camera_uid = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    department = Column(String, nullable=False)
    district = Column(String, nullable=False)
    location = Column(String, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    vms_vendor = Column(String, nullable=False)
    protocol_type = Column(String, nullable=False) # RTSP, HLS, ONVIF, VENDOR_SDK
    status = Column(String, nullable=False) # ACTIVE, INACTIVE, DEGRADED, OFFLINE
    ai_enabled = Column(Boolean, default=False)

    # Internal connection info, never exposed to frontend GET APIs directly
    rtsp_url = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
