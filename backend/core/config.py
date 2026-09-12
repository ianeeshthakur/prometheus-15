# Centralized environment configuration. Ported/extracted from contrib/aneesh/backend
# (previously scattered os.environ.get() calls across main.py, db.py, video/stream_manager.py).
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./gvista.db")
HLS_OUTPUT_DIR = os.environ.get("HLS_OUTPUT_DIR", "./hls_output")
APP_MODE = os.environ.get("APP_MODE", "DEMO")  # DEMO | LIVE -- docs/frontend.md §3.0 footer strip mirrors this

# Base URL for the hackathon's real simulated-feed catalogue (docs/backend.md §2).
# GET {INGEST_API_BASE_URL}/api/ingest returns the camera catalogue + RTSP/WHEP/HLS URLs.
# Unset until organizers provide the live host for the hackathon's infrastructure.
INGEST_API_BASE_URL = os.environ.get("INGEST_API_BASE_URL", "")

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
