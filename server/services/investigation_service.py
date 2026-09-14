# Investigation case CRUD + timeline/evidence -- docs/frontend.md §3.5, docs/backend.md §12.4.
import uuid
from typing import List, Optional
from sqlalchemy.orm import Session

from models.investigation import Investigation, InvestigationEvidence
from schemas.investigation import InvestigationCreate, EvidenceCreate, TimelineResponse
import services.event_service as event_service
import services.alert_service as alert_service


def create_investigation(db: Session, case_in: InvestigationCreate) -> Investigation:
    case = Investigation(
        case_uid=f"INV-{uuid.uuid4().hex[:8].upper()}",
        title=case_in.title,
        entity=case_in.entity,
        priority=case_in.priority,
        assigned_officer=case_in.assigned_officer,
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


def list_investigations(db: Session, status: Optional[str] = None, entity: Optional[str] = None) -> List[Investigation]:
    query = db.query(Investigation)
    if status:
        query = query.filter(Investigation.status == status)
    if entity:
        query = query.filter(Investigation.entity == entity)
    return query.order_by(Investigation.updated_at.desc()).all()


def get_by_uid(db: Session, case_uid: str) -> Optional[Investigation]:
    return db.query(Investigation).filter(Investigation.case_uid == case_uid).first()


def update_status(db: Session, case: Investigation, status: str) -> Investigation:
    case.status = status
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


def get_timeline(db: Session, case: Investigation) -> TimelineResponse:
    """Events and alerts (docs/frontend.md §3.5's Timeline tab) are derived by matching
    on the case's entity -- not their own table, see models/investigation.py's docstring."""
    events = event_service.list_events_by_identifier(db, case.entity)
    alerts = alert_service.list_alerts(db)  # filtered below since list_alerts has no entity filter yet
    matching_alerts = [a for a in alerts if a.entity == case.entity]
    return TimelineResponse(events=events, alerts=matching_alerts)


def add_evidence(db: Session, case: Investigation, evidence_in: EvidenceCreate) -> InvestigationEvidence:
    evidence = InvestigationEvidence(
        investigation_id=case.id,
        evidence_type=evidence_in.evidence_type,
        description=evidence_in.description,
        camera_uid=evidence_in.camera_uid,
        confidence=evidence_in.confidence,
        reference_event_id=evidence_in.reference_event_id,
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    return evidence


def list_evidence(db: Session, case: Investigation) -> List[InvestigationEvidence]:
    return (
        db.query(InvestigationEvidence)
        .filter(InvestigationEvidence.investigation_id == case.id)
        .order_by(InvestigationEvidence.added_at.asc())
        .all()
    )
