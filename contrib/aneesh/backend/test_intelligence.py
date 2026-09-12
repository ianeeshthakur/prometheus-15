import pytest
import uuid
from datetime import datetime
from fastapi.testclient import TestClient

from main import app
from db import Base, get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from ai.schemas import (
    AIAnalysisResult, DetectionResult, PlateResult, AnomalyResult, FrameQuality, PlateStatus
)

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Use test db
Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def create_mock_ai_result(
    camera_uid="CAM-TEST",
    vehicles=None,
    persons=None,
    plates=None,
    anomalies=None
):
    return AIAnalysisResult(
        camera_uid=camera_uid,
        timestamp=datetime.now(),
        frame_sequence=1,
        frame_quality=FrameQuality.GOOD,
        processing_time_ms=100,
        model_provider="TEST",
        overall_status="OK",
        vehicles=vehicles or [],
        persons=persons or [],
        plates=plates or [],
        anomalies=anomalies or []
    )

def create_mock_detection(class_name="person"):
    return DetectionResult(
        detection_id=f"D-{uuid.uuid4()}",
        class_name=class_name,
        confidence=0.9,
        bbox=[0,0,10,10],
        camera_uid="CAM-1",
        timestamp=datetime.now(),
        frame_sequence=1,
        model_name="yolo",
        model_provider="mock"
    )

def test_person_observation():
    person = create_mock_detection("person")
    payload = create_mock_ai_result(persons=[person])
    response = client.post("/api/intelligence/process", json=payload.model_dump(mode="json"))
    assert response.status_code == 200
    data = response.json()
    assert len(data["observations"]) == 1
    assert data["observations"][0]["attributes"]["class_name"] == "person"

def test_vehicle_observation():
    vehicle = DetectionResult(
        detection_id=f"D-{uuid.uuid4()}",
        class_name="car",
        confidence=0.8,
        bbox=[0,0,10,10],
        camera_uid="CAM-1",
        timestamp=datetime.now(),
        frame_sequence=1,
        model_name="yolo",
        model_provider="mock"
    )
    payload = create_mock_ai_result(vehicles=[vehicle])
    response = client.post("/api/intelligence/process", json=payload.model_dump(mode="json"))
    assert response.status_code == 200
    data = response.json()
    assert len(data["observations"]) == 1
    assert data["observations"][0]["attributes"]["class_name"] == "car"

def test_object_observation():
    detection = create_mock_detection("backpack")
    # Using 'detections' instead of persons/vehicles
    payload = AIAnalysisResult(
        camera_uid="CAM-1", timestamp=datetime.now(), frame_sequence=1, frame_quality=FrameQuality.GOOD,
        processing_time_ms=100, model_provider="TEST", overall_status="OK",
        detections=[detection], vehicles=[], persons=[], plates=[], anomalies=[]
    )
    response = client.post("/api/intelligence/process", json=payload.model_dump(mode="json"))
    assert response.status_code == 200
    data = response.json()
    assert len(data["observations"]) == 1
    assert data["observations"][0]["attributes"]["class_name"] == "backpack"

def test_contextual_anomaly_without_plate():
    anomaly = AnomalyResult(
        anomaly_id=f"A-{uuid.uuid4()}", anomaly_type="CROWD_FORMATION", confidence=0.85,
        camera_uid="CAM-1", timestamp=datetime.now(), frame_sequence=1, model_name="mock", status="DETECTED"
    )
    payload = create_mock_ai_result(anomalies=[anomaly])
    response = client.post("/api/intelligence/process", json=payload.model_dump(mode="json"))
    assert response.status_code == 200
    data = response.json()
    
    events = [e for e in data["events"] if e["event_type"] == "CONTEXTUAL_ANOMALY"]
    assert len(events) == 1
    assert events[0]["evidence"]["anomaly"] == "CROWD_FORMATION"

def test_license_plate_observation_with_watchlist_match():
    plate = PlateResult(
        plate_id=f"P-{uuid.uuid4()}",
        vehicle_detection_id="D-1",
        bbox=[0,0,10,10],
        raw_text="GJ05XX7821",
        normalized_text="GJ05XX7821",
        plate_detection_confidence=0.9,
        ocr_confidence=0.9,
        quality_score=0.9,
        final_confidence=0.9,
        confidence_level="HIGH",
        status=PlateStatus.READABLE
    )
    payload = create_mock_ai_result(plates=[plate])
    response = client.post("/api/intelligence/process", json=payload.model_dump(mode="json"))
    assert response.status_code == 200
    data = response.json()
    
    # Check that watchlist match happened
    assert len(data["watchlist_matches"]) > 0
    assert data["watchlist_matches"][0]["match_type"] == "EXACT"
    
    # Check events (Watchlist Candidate Event)
    assert any(e["event_type"] == "WATCHLIST_MATCH_CANDIDATE" for e in data["events"])

def test_cross_camera_correlation():
    # Detect plate at CAM-1
    unique_plate = f"GJ01TEST{uuid.uuid4().hex[:4]}"
    plate = PlateResult(
        plate_id=f"P-{uuid.uuid4()}",
        vehicle_detection_id="D-1",
        bbox=[0,0,10,10],
        raw_text=unique_plate,
        normalized_text=unique_plate,
        plate_detection_confidence=0.9,
        ocr_confidence=0.9,
        quality_score=0.9,
        final_confidence=0.9,
        confidence_level="HIGH",
        status=PlateStatus.READABLE
    )
    payload1 = create_mock_ai_result(camera_uid="CAM-1", plates=[plate])
    client.post("/api/intelligence/process", json=payload1.model_dump(mode="json"))
    
    # Detect same plate at CAM-2
    payload2 = create_mock_ai_result(camera_uid="CAM-2", plates=[plate])
    response = client.post("/api/intelligence/process", json=payload2.model_dump(mode="json"))
    
    assert response.status_code == 200
    data = response.json()
    print("SECOND RESPONSE", data)
    
    # Should see cross camera correlation event
    cross_cam_events = [e for e in data["events"] if e["event_type"] == "CROSS_CAMERA_ENTITY_OBSERVATION"]
    assert len(cross_cam_events) > 0

def test_cross_department_correlation():
    unique_dept_plate = f"GJ05{uuid.uuid4().hex[:4]}"
    plate = PlateResult(
        plate_id=f"P-{uuid.uuid4()}", vehicle_detection_id="D-1", bbox=[0,0,10,10],
        raw_text=unique_dept_plate, normalized_text=unique_dept_plate, plate_detection_confidence=0.9, ocr_confidence=0.9,
        quality_score=0.9, final_confidence=0.9, confidence_level="HIGH", status=PlateStatus.READABLE
    )
    
    # We must mock Camera context directly in DB for cross department.
    from models import Camera
    db = TestingSessionLocal()
    if not db.query(Camera).filter_by(camera_uid="CAM-DEPT1").first():
        db.add(Camera(camera_uid="CAM-DEPT1", name="C1", department="Police", district="A", location="B", vms_vendor="V", protocol_type="RTSP", status="ACTIVE"))
    if not db.query(Camera).filter_by(camera_uid="CAM-DEPT2").first():
        db.add(Camera(camera_uid="CAM-DEPT2", name="C2", department="Municipal", district="A", location="B", vms_vendor="V", protocol_type="RTSP", status="ACTIVE"))
    db.commit()
    db.close()

    payload1 = create_mock_ai_result(camera_uid="CAM-DEPT1", plates=[plate])
    client.post("/api/intelligence/process", json=payload1.model_dump(mode="json"))
    
    payload2 = create_mock_ai_result(camera_uid="CAM-DEPT2", plates=[plate])
    response = client.post("/api/intelligence/process", json=payload2.model_dump(mode="json"))
    data = response.json()
    
    cross_dept_events = [e for e in data["events"] if e["event_type"] == "CROSS_DEPARTMENT_CORRELATION"]
    assert len(cross_dept_events) > 0
    assert "Municipal" in cross_dept_events[0]["evidence"]["departments"]
    assert "Police" in cross_dept_events[0]["evidence"]["departments"]

def test_external_connector_mock():
    # Use plate GJ01AB1234 which exists in MockVahanConnector
    plate = PlateResult(
        plate_id=f"P-{uuid.uuid4()}",
        vehicle_detection_id="D-1",
        bbox=[0,0,10,10],
        raw_text="GJ01AB1234",
        normalized_text="GJ01AB1234",
        plate_detection_confidence=0.9,
        ocr_confidence=0.9,
        quality_score=0.9,
        final_confidence=0.9,
        confidence_level="HIGH",
        status=PlateStatus.READABLE
    )
    payload = create_mock_ai_result(plates=[plate])
    response = client.post("/api/intelligence/process", json=payload.model_dump(mode="json"))
    assert response.status_code == 200
    data = response.json()
    
    # Should see external data correlation event
    external_events = [e for e in data["events"] if e["event_type"] == "EXTERNAL_DATA_CORRELATION"]
    assert len(external_events) > 0
    assert external_events[0]["evidence"]["source"] == "VAHAN"

def test_multiple_entities_in_one_observation():
    person = DetectionResult(
        detection_id=f"D-P", class_name="person", confidence=0.9, bbox=[0,0,10,10], camera_uid="CAM-1", timestamp=datetime.now(), frame_sequence=1, model_name="yolo", model_provider="mock"
    )
    vehicle = DetectionResult(
        detection_id=f"D-V", class_name="car", confidence=0.8, bbox=[0,0,10,10], camera_uid="CAM-1", timestamp=datetime.now(), frame_sequence=1, model_name="yolo", model_provider="mock"
    )
    payload = create_mock_ai_result(persons=[person], vehicles=[vehicle])
    response = client.post("/api/intelligence/process", json=payload.model_dump(mode="json"))
    assert response.status_code == 200
    data = response.json()
    assert len(data["observations"]) == 2

def test_pipeline4_works_without_pipeline5():
    # Process shouldn't fail even if no P5 consumers exist
    payload = create_mock_ai_result()
    response = client.post("/api/intelligence/process", json=payload.model_dump(mode="json"))
    assert response.status_code == 200
    assert "observations" in response.json()

def test_no_credentials_exposed():
    # Calling the events API shouldn't show any credentials
    response = client.get("/api/intelligence/events")
    assert response.status_code == 200
    data = response.json()
    json_str = str(data).lower()
    assert "password" not in json_str
    assert "token" not in json_str

def test_get_entity_timeline():
    # Assuming previous tests populated some plates
    response = client.get("/api/intelligence/entities/ENT-L-GJ01AB1234/timeline")
    if response.status_code == 200:
        data = response.json()
        assert isinstance(data, list)
    else:
        assert response.status_code == 404
