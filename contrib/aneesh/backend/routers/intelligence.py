from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from db import get_db
from ai.schemas import AIAnalysisResult
from intelligence.schemas import (
    CorrelatedIntelligenceResult, 
    IntelligenceEventResponse, 
    IntelligenceEntityResponse,
    WatchlistMatchResponse
)
from intelligence.engine import IntelligenceEngine
from intelligence.models import IntelligenceEvent, IntelligenceEntity, WatchlistMatchRecord, IntelligenceObservation

router = APIRouter()
engine = IntelligenceEngine()

@router.post("/process", response_model=CorrelatedIntelligenceResult)
async def process_ai_result(ai_result: AIAnalysisResult, db: Session = Depends(get_db)):
    """
    Ingests Pipeline 3 output (AIAnalysisResult) and generates intelligence & correlation.
    """
    try:
        result = engine.process(ai_result, db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/events", response_model=List[IntelligenceEventResponse])
async def get_events(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    events = db.query(IntelligenceEvent).order_by(IntelligenceEvent.timestamp.desc()).offset(skip).limit(limit).all()
    return events

@router.get("/events/{event_id}", response_model=IntelligenceEventResponse)
async def get_event(event_id: str, db: Session = Depends(get_db)):
    event = db.query(IntelligenceEvent).filter(IntelligenceEvent.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

@router.get("/entities/{entity_id}", response_model=IntelligenceEntityResponse)
async def get_entity(entity_id: str, db: Session = Depends(get_db)):
    entity = db.query(IntelligenceEntity).filter(IntelligenceEntity.entity_id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return entity

@router.get("/entities/{entity_id}/timeline")
async def get_entity_timeline(entity_id: str, db: Session = Depends(get_db)):
    observations = db.query(IntelligenceObservation).filter(IntelligenceObservation.entity_id == entity_id).order_by(IntelligenceObservation.timestamp.desc()).all()
    return observations

@router.get("/watchlist-matches", response_model=List[WatchlistMatchResponse])
async def get_watchlist_matches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    matches = db.query(WatchlistMatchRecord).order_by(WatchlistMatchRecord.timestamp.desc()).offset(skip).limit(limit).all()
    return matches
