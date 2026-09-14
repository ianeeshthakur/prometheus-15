# Centralized environment configuration. Ported/extracted from contrib/aneesh/backend
# (previously scattered os.environ.get() calls across main.py, db.py, video/stream_manager.py).
import json
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

# Real-payload field-name overrides for integration/ingest_sync.py -- docs/backend.md
# §12.7. A JSON object string, e.g. '{"vendor": "vms_vendor", "cam_id": "camera_uid"}'.
# Lets a rename in the real (currently unknown) /api/ingest payload be fixed by
# restarting with a new env var instead of editing code. Empty until there's a real
# payload to look at -- see integration/ingest_sync.py's preview_ingest_catalogue().
try:
    INGEST_FIELD_ALIASES = json.loads(os.environ.get("INGEST_FIELD_ALIASES", "{}"))
except json.JSONDecodeError:
    INGEST_FIELD_ALIASES = {}

# A real hackathon test rig ("corp8.cloud") found 2026-09-13, docs/backend.md §12.7.
# Its camera catalogue is a flat GET at a fixed URL, not a path under a configurable
# base -- a different shape than the INGEST_API_BASE_URL + "/api/ingest" contract
# assumed above (docs/backend.md §2, still the documented shape for the official
# Sentinel portal contract). When set, INGEST_CATALOGUE_URL is used AS-IS and takes
# priority; see integration/ingest_sync.py's _fetch_catalogue().
INGEST_CATALOGUE_URL = os.environ.get("INGEST_CATALOGUE_URL", "")

# RTSP on this rig authenticates per-connection via a registered email+password
# embedded in the URL (rtsp://email:password@host:port/stream/<id>), not a per-camera
# credential returned by the catalogue itself -- a public catalogue response almost
# certainly can't include a working authenticated URL without leaking credentials to
# every caller. integration/ingest_sync.py synthesizes the URL from these instead of
# guessing at a catalogue field for it. All four unset by default; never commit real
# values here -- set them only in your local, gitignored .env (see .env.example).
INGEST_STREAM_EMAIL = os.environ.get("INGEST_STREAM_EMAIL", "")
INGEST_STREAM_PASSWORD = os.environ.get("INGEST_STREAM_PASSWORD", "")
INGEST_RTSP_HOST = os.environ.get("INGEST_RTSP_HOST", "")
INGEST_RTSP_PORT = os.environ.get("INGEST_RTSP_PORT", "8554")

# Default covers client/'s real dev server (Vite, port 5173, docs/frontend.md §1).
# Caught for real 2026-09-14: this defaulted to port 3000 only (the old Next.js dev
# port, contrib/nextjs-frontend-archive/) from before the client swap -- nobody
# updated it, so every /api/* call from the actual current client silently failed
# CORS preflight and the app fell back to mock mode, indistinguishable at a glance
# from "backend not running". 3000 kept for anyone still running the archived app.
CORS_ORIGINS = os.environ.get(
    "CORS_ORIGINS",
    # Local dev servers (Vite auto-increments past 5173 when port is taken)
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:5174,http://127.0.0.1:5174,"
    "http://localhost:5175,http://127.0.0.1:5175,"
    "http://localhost:3000,http://127.0.0.1:3000,"
    # Production Vercel deployment
    "https://gujarat-police-three.vercel.app,"
    # Vercel preview deployments (any subdomain)
    "https://*.vercel.app",
).split(",")

# Auth (docs/backend.md §7/§12.4). SECRET_KEY MUST be overridden via env before any real
# deployment -- this default is fine for local dev only and is deliberately obvious so
# nobody mistakes it for a real secret. main.py's lifespan refuses to start in
# APP_MODE=LIVE if SECRET_KEY still equals this default (docs/backend.md §12.6 fix) --
# exposed as a named constant here specifically so that check can compare against it
# without duplicating the literal.
DEFAULT_INSECURE_SECRET_KEY = "dev-insecure-secret-change-me-before-any-real-use"
SECRET_KEY = os.environ.get("SECRET_KEY", DEFAULT_INSECURE_SECRET_KEY)
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "480"))  # 8h shift

# Rate limiting on /api/auth/login (core/rate_limit.py) -- docs/backend.md §7.1/§12.6.
LOGIN_RATE_LIMIT_MAX_ATTEMPTS = int(os.environ.get("LOGIN_RATE_LIMIT_MAX_ATTEMPTS", "5"))
LOGIN_RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("LOGIN_RATE_LIMIT_WINDOW_SECONDS", "300"))  # 5 minutes

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
