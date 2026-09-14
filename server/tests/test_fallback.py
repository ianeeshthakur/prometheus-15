import pytest
import numpy as np
from fastapi.testclient import TestClient
from main import app
from ai.schemas import AIProfile
from ai.real_providers import RealPlateDetector
from routers.ai import orchestrators

client = TestClient(app)

def test_ai_health_dynamic():
    # Force the orchestrator to have a configured plate detector
    orchestrators[AIProfile.TRAFFIC].plate_detector.configured = True
    response = client.get("/api/ai/health")
    assert response.status_code == 200
    data = response.json()
    assert data["providers"]["plate"] == "REAL"
    
    # Force it to unconfigured
    orchestrators[AIProfile.TRAFFIC].plate_detector.configured = False
    response = client.get("/api/ai/health")
    assert response.status_code == 200
    data = response.json()
    assert data["providers"]["plate"] == "MOCK_READY"

def test_fallback_plate_detection():
    # Test that a POST to analyze-frame with a fake image will invoke the RealPlateDetector
    # We will mock the RealPlateDetector to confirm it gets called on FULL_FRAME
    class MockFallbackPlateDetector:
        def __init__(self):
            self.configured = True
            self.called_with_full_frame = False
        def detect(self, frame, vehicle_id, *args, **kwargs):
            if vehicle_id == "FULL_FRAME":
                self.called_with_full_frame = True
            return {"bbox": [10, 10, 100, 50], "plate_detection_confidence": 0.95}

    old_detector = orchestrators[AIProfile.TRAFFIC].plate_detector
    mock_pd = MockFallbackPlateDetector()
    orchestrators[AIProfile.TRAFFIC].plate_detector = mock_pd
    
    response = client.post("/api/ai/analyze-frame", json={
        "camera_uid": "CAM-01",
        "profile": "TRAFFIC",
        "width": 640,
        "height": 480
    })
    
    assert response.status_code == 200
    assert mock_pd.called_with_full_frame is True
    data = response.json()
    # Should have 1 plate detection even though vehicle count is 0
    assert len(data["plates"]) == 1
    assert data["plates"][0]["vehicle_detection_id"] == "FULL_FRAME"
    
    # Restore
    orchestrators[AIProfile.TRAFFIC].plate_detector = old_detector
