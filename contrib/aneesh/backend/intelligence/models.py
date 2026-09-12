from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from db import Base

class IntelligenceEntity(Base):
    __tablename__ = "intelligence_entities"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(String, unique=True, index=True, nullable=False)
    entity_type = Column(String, index=True, nullable=False)  # PERSON, VEHICLE, LICENSE_PLATE, OBJECT, CAMERA, EVENT
    attributes = Column(JSON, nullable=True)
    first_seen = Column(DateTime(timezone=True), server_default=func.now())
    last_seen = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    
class IntelligenceObservation(Base):
    __tablename__ = "intelligence_observations"

    id = Column(Integer, primary_key=True, index=True)
    observation_id = Column(String, unique=True, index=True, nullable=False)
    entity_id = Column(String, index=True, nullable=False)
    camera_uid = Column(String, index=True, nullable=False)
    department = Column(String, index=True, nullable=True) # Context enrichment
    timestamp = Column(DateTime(timezone=True), nullable=False)
    confidence = Column(Float, nullable=False)
    attributes = Column(JSON, nullable=True)
    
class IntelligenceEvent(Base):
    __tablename__ = "intelligence_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String, unique=True, index=True, nullable=False)
    event_type = Column(String, index=True, nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    severity = Column(String, nullable=True)
    confidence = Column(Float, nullable=False)
    description = Column(String, nullable=True)
    related_entities = Column(JSON, nullable=True) # List of entity_ids
    evidence = Column(JSON, nullable=True)
    status = Column(String, nullable=True, default="NEW")

class WatchlistMatchRecord(Base):
    __tablename__ = "watchlist_matches"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(String, unique=True, index=True, nullable=False)
    watchlist_id = Column(String, index=True, nullable=False)
    entity_id = Column(String, index=True, nullable=False)
    match_type = Column(String, nullable=False) # e.g. EXACT, FUZZY, CANDIDATE
    confidence = Column(Float, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
