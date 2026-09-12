import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from intelligence.schemas import IntelligenceEventResponse
from .models import Alert, Investigation, Evidence, TimelineEntry, OperatorAction
from .schemas import AlertStatusUpdate, InvestigationCreate, AlertResponse, InvestigationResponse

class OperationsEngine:
    def process_intake(self, db: Session, event: IntelligenceEventResponse) -> AlertResponse:
        # Check idempotency
        existing_alert = db.query(Alert).filter(Alert.source_event_id == event.event_id).first()
        if existing_alert:
            return AlertResponse.model_validate(existing_alert)

        # Assess priority
        priority = "LOW"
        if event.event_type == "WATCHLIST_MATCH_CANDIDATE":
            priority = "HIGH"
        elif event.event_type in ["EXTERNAL_DATA_CORRELATION", "CROSS_DEPARTMENT_CORRELATION"]:
            priority = "MEDIUM"
        
        # Override with event severity if present
        if event.severity == "CRITICAL":
            priority = "CRITICAL"
        elif event.severity == "HIGH":
            priority = "HIGH"

        alert = Alert(
            alert_id=f"ALT-{uuid.uuid4().hex[:8]}",
            source_event_id=event.event_id,
            alert_type=event.event_type,
            title=event.description or f"Operational Alert: {event.event_type}",
            description=f"Confidence: {event.confidence}. Entities: {event.related_entities}",
            priority=priority,
            severity=event.severity,
            status="NEW"
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        return AlertResponse.model_validate(alert)

    def update_alert_status(self, db: Session, alert_id: str, update: AlertStatusUpdate) -> AlertResponse:
        alert = db.query(Alert).filter(Alert.alert_id == alert_id).first()
        if not alert:
            raise ValueError("Alert not found")
            
        valid_transitions = {
            "NEW": ["ACKNOWLEDGED", "DISMISSED"],
            "ACKNOWLEDGED": ["UNDER_REVIEW"],
            "UNDER_REVIEW": ["ESCALATED", "RESOLVED"],
            "ESCALATED": ["RESOLVED"]
        }
        
        if update.status not in valid_transitions.get(alert.status, []):
            raise ValueError(f"Invalid transition from {alert.status} to {update.status}")
            
        previous = alert.status
        alert.status = update.status
        if update.status == "ACKNOWLEDGED":
            alert.acknowledged_at = datetime.now()
        elif update.status in ["RESOLVED", "DISMISSED"]:
            alert.resolved_at = datetime.now()
            alert.resolution_reason = update.reason

        action = OperatorAction(
            action_id=f"ACT-{uuid.uuid4().hex[:8]}",
            actor_id=update.actor_id,
            action_type="ALERT_STATUS_UPDATE",
            target_type="ALERT",
            target_id=alert.alert_id,
            previous_state=previous,
            new_state=update.status,
            reason=update.reason
        )
        db.add(action)
        db.commit()
        db.refresh(alert)
        return AlertResponse.model_validate(alert)

    def create_investigation(self, db: Session, create: InvestigationCreate) -> InvestigationResponse:
        inv = Investigation(
            investigation_id=f"INV-{uuid.uuid4().hex[:8]}",
            title=create.title,
            description=create.description,
            priority=create.priority,
            source_alert_id=create.source_alert_id,
            assigned_investigator=create.actor_id,
            status="OPEN"
        )
        db.add(inv)
        
        # Audit trail
        action = OperatorAction(
            action_id=f"ACT-{uuid.uuid4().hex[:8]}",
            actor_id=create.actor_id,
            action_type="INVESTIGATION_OPENED",
            target_type="INVESTIGATION",
            target_id=inv.investigation_id,
            new_state="OPEN"
        )
        db.add(action)
        
        # Auto-attach source alert as evidence if present
        if create.source_alert_id:
            ev = Evidence(
                evidence_id=f"EVI-{uuid.uuid4().hex[:8]}",
                investigation_id=inv.investigation_id,
                source_type="ALERT",
                source_reference=create.source_alert_id,
                evidence_type="SOURCE_ALERT"
            )
            db.add(ev)
            
            tl = TimelineEntry(
                entry_id=f"TLE-{uuid.uuid4().hex[:8]}",
                investigation_id=inv.investigation_id,
                timestamp=datetime.now(),
                entry_type="INVESTIGATION_OPENED",
                description=f"Investigation opened from Alert {create.source_alert_id}",
                reference_id=create.source_alert_id
            )
            db.add(tl)
            
        db.commit()
        db.refresh(inv)
        return InvestigationResponse.model_validate(inv)
