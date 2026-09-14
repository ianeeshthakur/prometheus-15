# AI profile config + thresholds -- docs/ai_pipelines.md §1. Ported verbatim from
# contrib/aneesh/backend/ai/config.py.
from .schemas import AIProfile

# Thresholds
OCR_CONFIDENCE_THRESHOLD = 0.70
PLATE_CONFIDENCE_THRESHOLD = 0.60
DETECTION_CONFIDENCE_THRESHOLD = 0.50

# Sampling configuration (for the not-yet-built video/frame_sampler.py -- docs/backend.md §12)
AI_TARGET_FPS = 5
AI_FRAME_SKIP = 3  # e.g. process 1 out of every 4 frames

# Provider Configuration
PROVIDER_MODE = "REAL"  # "REAL" or "MOCK"
DEVICE = "cpu"  # "cpu", "cuda", "mps"
PLATE_MODEL_PATH = "ai/models/plate/best.pt"

AI_PROFILES_CONFIG = {
    AIProfile.TRAFFIC: {
        "vehicle_detection": True,
        "plate_detection": True,
        "ocr": True,
        "person_detection": False,
        "anomaly_detection": False,
    },
    AIProfile.SECURITY: {
        "vehicle_detection": False,
        "plate_detection": False,
        "ocr": False,
        "person_detection": True,
        "anomaly_detection": True,
    },
    AIProfile.RTO: {
        "vehicle_detection": True,
        "plate_detection": True,
        "ocr": True,
        "person_detection": False,
        "anomaly_detection": False,
    },
}
