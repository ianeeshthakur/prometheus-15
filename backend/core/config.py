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

# Auth (docs/backend.md §7/§12.4). SECRET_KEY MUST be overridden via env before any real
# deployment -- this default is fine for local dev only and is deliberately obvious so
# nobody mistakes it for a real secret.
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-insecure-secret-change-me-before-any-real-use")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "480"))  # 8h shift

# Bootstrap admin, created on first startup only if the users table is empty (see
# main.py's lifespan) -- there is no other way to get the first ADMIN account on a
# fresh DB. CHANGE THE PASSWORD before any real deployment; the default is loud on
# purpose so it's obviously a placeholder.
ADMIN_BOOTSTRAP_USERNAME = os.environ.get("ADMIN_BOOTSTRAP_USERNAME", "admin")
ADMIN_BOOTSTRAP_PASSWORD = os.environ.get("ADMIN_BOOTSTRAP_PASSWORD", "changeme123")

# Fuzzy watchlist matching (intelligence/watchlist_matcher.py) -- OFF by default. See
# that module's docstring: the algorithm is real and tested, but an untuned distance
# threshold risks false-positive watchlist alerts. Only flip this on once real OCR
# error-rate data justifies FUZZY_WATCHLIST_MAX_DISTANCE.
ENABLE_FUZZY_WATCHLIST_MATCHING = os.environ.get("ENABLE_FUZZY_WATCHLIST_MATCHING", "false").lower() == "true"
FUZZY_WATCHLIST_MAX_DISTANCE = int(os.environ.get("FUZZY_WATCHLIST_MAX_DISTANCE", "1"))
