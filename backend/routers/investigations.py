# /api/investigations -- docs/frontend.md §3.5. Built during the docs/backend.md §12.4
# build-out. Timeline and map-trace are derived (see models/investigation.py's
# docstring and intelligence/entity_graph.py), not stored directly.
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from db.database import get_db
import services.investigation_service as investigation_service
from intelligence.entity_graph import trace_entity
from schemas.investigation import (
    InvestigationCreate,
    InvestigationResponse,
    InvestigationStatusUpdate,
    EvidenceCreate,
    EvidenceResponse,
    TimelineResponse,
    TraceResponse,
)
from core.security import get_current_user, log_action
from models.user import User

router = APIRouter()


def _get_case_or_404(db: Session, case_uid: str):
    case = investigation_service.get_by_uid(db, case_uid)
    if not case:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return case


@router.get("/", response_model=List[InvestigationResponse])
async def list_investigations(status: Optional[str] = None, entity: Optional[str] = None, db: Session = Depends(get_db)):
    return investigation_service.list_investigations(db, status, entity)


@router.post("/", response_model=InvestigationResponse, status_code=201)
async def create_investigation(
    case_in: InvestigationCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    case = investigation_service.create_investigation(db, case_in)
    log_action("INVESTIGATION_CREATED", user=user, resource_type="investigation", resource_id=case.case_uid, db=db)
    return case


@router.get("/{case_uid}", response_model=InvestigationResponse)
async def get_investigation(case_uid: str, db: Session = Depends(get_db)):
    return _get_case_or_404(db, case_uid)


@router.patch("/{case_uid}/status", response_model=InvestigationResponse)
async def update_investigation_status(
    case_uid: str,
    payload: InvestigationStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    case = _get_case_or_404(db, case_uid)
    investigation_service.update_status(db, case, payload.status)
    log_action(f"INVESTIGATION_{payload.status}", user=user, resource_type="investigation", resource_id=case_uid, db=db)
    return case


@router.get("/{case_uid}/timeline", response_model=TimelineResponse)
async def get_timeline(case_uid: str, db: Session = Depends(get_db)):
    case = _get_case_or_404(db, case_uid)
    return investigation_service.get_timeline(db, case)


@router.get("/{case_uid}/trace", response_model=TraceResponse)
async def get_trace(case_uid: str, db: Session = Depends(get_db)):
    """docs/frontend.md §3.5's "Map trace" tab -- also the graded hackathon-day
    vehicle-tracking test (docs/prd.md §0.1) once wired to real camera feeds."""
    case = _get_case_or_404(db, case_uid)
    sightings = trace_entity(db, case.entity)
    return TraceResponse(entity=case.entity, sightings=sightings)


@router.get("/{case_uid}/evidence", response_model=List[EvidenceResponse])
async def list_evidence(case_uid: str, db: Session = Depends(get_db)):
    case = _get_case_or_404(db, case_uid)
    return investigation_service.list_evidence(db, case)


@router.post("/{case_uid}/evidence", response_model=EvidenceResponse, status_code=201)
async def add_evidence(
    case_uid: str,
    evidence_in: EvidenceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    case = _get_case_or_404(db, case_uid)
    evidence = investigation_service.add_evidence(db, case, evidence_in)
    log_action(
        "EVIDENCE_ADDED", user=user, resource_type="investigation", resource_id=case_uid,
        detail=evidence_in.evidence_type, db=db,
    )
    return evidence
