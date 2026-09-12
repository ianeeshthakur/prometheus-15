from .schemas import AIProfile

# Thresholds
OCR_CONFIDENCE_THRESHOLD = 0.70
PLATE_CONFIDENCE_THRESHOLD = 0.60
DETECTION_CONFIDENCE_THRESHOLD = 0.50

# Sampling Configuration
AI_TARGET_FPS = 5
AI_FRAME_SKIP = 3  # E.g. process 1 out of every 4 frames

# Profiles configuration
AI_PROFILES_CONFIG = {
    AIProfile.TRAFFIC: {
        "vehicle_detection": True,
        "plate_detection": True,
        "ocr": True,
        "person_detection": False,
        "anomaly_detection": False
    },
    AIProfile.SECURITY: {
        "vehicle_detection": False,
        "plate_detection": False,
        "ocr": False,
        "person_detection": True,
        "anomaly_detection": True
    },
    AIProfile.RTO: {
        "vehicle_detection": True,
        "plate_detection": True,
        "ocr": True,
        "person_detection": False,
        "anomaly_detection": False
    }
}
