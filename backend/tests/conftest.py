# pytest fixtures -- docs/backend.md §12.4 ("convert tests/*.py scripts to real
# pytest"). Uses FastAPI's TestClient (in-process, no live uvicorn needed) against an
# isolated SQLite file, never the dev DATABASE_URL a developer might have real data in.
#
# DB fixture is session-scoped (one app/DB for the whole pytest run), not per-test --
# a true per-test-isolated DB would need engine/SessionLocal recreated per test, which
# isn't practical without restructuring db/database.py's module-level singletons.
# Compromise, closing part of docs/backend.md §12.5's isolation gap: an autouse,
# module-scoped fixture below wipes every operational table (camera/alert/watchlist/
# investigation/event/facial-recognition data -- NOT users or the audit log, which
# need to survive for auth and audit-continuity to keep working across files) after
# each test *file* finishes. This eliminates cross-file contamination, which was the
# actual risk; tests *within* one file still intentionally share state in sequence
# (verified: no test file currently depends on another file's data, only on its own
# earlier tests) using the same distinct-identifier convention the original standalone
# scripts used.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_TEST_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "test_gvista.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_PATH}"
os.environ["ADMIN_BOOTSTRAP_PASSWORD"] = "test-admin-pass"

if os.path.exists(_TEST_DB_PATH):
    os.remove(_TEST_DB_PATH)

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client():
    import main  # imported here, after DATABASE_URL is set above

    with TestClient(main.app) as c:
        yield c

    # SQLAlchemy's connection pool can still hold the file open on Windows at this
    # point; disposing the engine releases it. Best-effort either way -- the next
    # run's cleanup at module-import time above will remove any leftover file.
    main.engine.dispose()
    try:
        if os.path.exists(_TEST_DB_PATH):
            os.remove(_TEST_DB_PATH)
    except PermissionError:
        pass


@pytest.fixture(scope="session")
def admin_token(client):
    resp = client.post("/api/auth/login", json={"username": "admin", "password": "test-admin-pass"})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module", autouse=True)
def _clean_operational_tables_after_module(client):
    """See the module docstring above for why this is module-scoped, not
    function-scoped, and why User/AuditLogEntry are excluded."""
    yield
    from db.database import SessionLocal
    from models.camera import Camera
    from models.event import CameraEvent
    from models.alert import Alert
    from models.watchlist import WatchlistEntry, WatchlistMatch
    from models.investigation import Investigation, InvestigationEvidence
    from models.admin_settings import FacialRecognitionAuthorization

    db = SessionLocal()
    try:
        for model in (
            InvestigationEvidence,
            Investigation,
            Alert,
            WatchlistMatch,
            WatchlistEntry,
            CameraEvent,
            Camera,
            FacialRecognitionAuthorization,
        ):
            db.query(model).delete()
        db.commit()
    finally:
        db.close()
