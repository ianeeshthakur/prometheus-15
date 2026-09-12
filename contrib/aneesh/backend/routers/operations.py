from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from db import get_db
from operations.schemas import (
    OperationalIntake,
    AlertResponse,
    AlertStatusUpdate,
    InvestigationCreate,
    InvestigationResponse,
    TimelineEntryResponse
)
from operations.engine import OperationsEngine
from operations.models import Alert, Investigation, TimelineEntry
from intelligence.models import IntelligenceObservation, IntelligenceEvent

router = APIRouter()
engine = OperationsEngine()

@router.post("/intake", response_model=AlertResponse)
def process_operational_intake(intake: OperationalIntake, db: Session = Depends(get_db)):
    try:
        return engine.process_intake(db, intake.event)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/alerts", response_model=List[AlertResponse])
def get_alerts(db: Session = Depends(get_db)):
    alerts = db.query(Alert).order_by(Alert.created_at.desc()).limit(100).all()
    return [AlertResponse.model_validate(a) for a in alerts]

@router.get("/alerts/{alert_id}", response_model=AlertResponse)
def get_alert(alert_id: str, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.alert_id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return AlertResponse.model_validate(alert)

@router.patch("/alerts/{alert_id}/status", response_model=AlertResponse)
def update_alert_status(alert_id: str, update: AlertStatusUpdate, db: Session = Depends(get_db)):
    try:
        return engine.update_alert_status(db, alert_id, update)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/investigations", response_model=InvestigationResponse)
def create_investigation(create: InvestigationCreate, db: Session = Depends(get_db)):
    return engine.create_investigation(db, create)

@router.get("/investigations/{investigation_id}", response_model=InvestigationResponse)
def get_investigation(investigation_id: str, db: Session = Depends(get_db)):
    inv = db.query(Investigation).filter(Investigation.investigation_id == investigation_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return InvestigationResponse.model_validate(inv)

@router.get("/entities/{entity_id}/timeline")
def get_entity_timeline(entity_id: str, db: Session = Depends(get_db)):
    # Timeline generation from upstream P4
    # Uses basic JSON matching for SQLite compatibility (like %entity_id%)
    observations = db.query(IntelligenceObservation).filter(IntelligenceObservation.entity_id == entity_id).order_by(IntelligenceObservation.timestamp.asc()).all()
    
    # Simple workaround for sqlite JSON filtering in test
    all_events = db.query(IntelligenceEvent).all()
    events = [e for e in all_events if e.related_entities and entity_id in e.related_entities]
    events = sorted(events, key=lambda x: x.timestamp)
    
    return {
        "entity_id": entity_id,
        "observations": observations,
        "events": events
    }
