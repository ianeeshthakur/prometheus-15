import uuid
from datetime import datetime
from fastapi.testclient import TestClient

from main import app
from db import Base, get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from intelligence.schemas import IntelligenceEventResponse

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def create_mock_intelligence_event(event_type="WATCHLIST_MATCH_CANDIDATE", severity="HIGH") -> IntelligenceEventResponse:
    return IntelligenceEventResponse(
        id=0,
        event_id=f"EVT-{uuid.uuid4().hex[:8]}",
        event_type=event_type,
        timestamp=datetime.now(),
        severity=severity,
        confidence=0.9,
        description="Mock P4 Event",
        related_entities=[f"ENT-{uuid.uuid4().hex[:8]}"],
        evidence={"mock": "data"},
        status="NEW"
    )

def test_p4_intake_creates_alert():
    event = create_mock_intelligence_event()
    payload = {"event": event.model_dump(mode="json")}
    
    response = client.post("/api/operations/intake", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["alert_type"] == "WATCHLIST_MATCH_CANDIDATE"
    assert data["status"] == "NEW"
    assert data["priority"] == "HIGH"
    
def test_intake_idempotency():
    event = create_mock_intelligence_event()
    payload = {"event": event.model_dump(mode="json")}
    
    response1 = client.post("/api/operations/intake", json=payload)
    alert_id1 = response1.json()["alert_id"]
    
    response2 = client.post("/api/operations/intake", json=payload)
    alert_id2 = response2.json()["alert_id"]
    
    assert alert_id1 == alert_id2

def test_alert_status_transitions():
    event = create_mock_intelligence_event()
    payload = {"event": event.model_dump(mode="json")}
    
    response = client.post("/api/operations/intake", json=payload)
    alert_id = response.json()["alert_id"]
    
    # ACKNOWLEDGE
    ack_res = client.patch(f"/api/operations/alerts/{alert_id}/status", json={"status": "ACKNOWLEDGED", "actor_id": "officer-1"})
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "ACKNOWLEDGED"
    
    # INVALID TRANSITION
    inv_res = client.patch(f"/api/operations/alerts/{alert_id}/status", json={"status": "RESOLVED", "actor_id": "officer-1"})
    assert inv_res.status_code == 400
    
    # UNDER_REVIEW
    ur_res = client.patch(f"/api/operations/alerts/{alert_id}/status", json={"status": "UNDER_REVIEW", "actor_id": "officer-1"})
    assert ur_res.status_code == 200

def test_investigation_creation():
    event = create_mock_intelligence_event()
    payload = {"event": event.model_dump(mode="json")}
    
    response = client.post("/api/operations/intake", json=payload)
    alert_id = response.json()["alert_id"]
    
    inv_payload = {
        "title": "Stolen Vehicle Investigation",
        "description": "Investigating hit from camera A",
        "priority": "HIGH",
        "source_alert_id": alert_id,
        "actor_id": "officer-1"
    }
    
    inv_res = client.post("/api/operations/investigations", json=inv_payload)
    assert inv_res.status_code == 200
    data = inv_res.json()
    assert data["status"] == "OPEN"
    assert data["source_alert_id"] == alert_id
    
def test_entity_timeline():
    # Verify the endpoint exists and returns the structure
    entity_id = f"ENT-{uuid.uuid4().hex[:8]}"
    res = client.get(f"/api/operations/entities/{entity_id}/timeline")
    assert res.status_code == 200
    assert "observations" in res.json()
    assert "events" in res.json()
