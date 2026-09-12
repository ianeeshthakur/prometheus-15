# pytest fixtures -- docs/backend.md §12.4 ("convert tests/*.py scripts to real
# pytest"). Uses FastAPI's TestClient (in-process, no live uvicorn needed) against an
# isolated SQLite file, never the dev DATABASE_URL a developer might have real data in.
#
# DB fixture is session-scoped (one app/DB for the whole pytest run), not per-test --
# a true per-test-isolated DB would need engine/SessionLocal recreated per test, which
# isn't practical without restructuring db/database.py's module-level singletons. Test
# functions below use distinct identifiers per concern (same convention the original
# standalone scripts used) specifically so they can safely share one DB across a run.
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
