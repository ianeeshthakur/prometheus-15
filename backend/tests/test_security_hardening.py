# Tests for docs/backend.md §7.1/§12.6's security-hardening pass: rate limiting, JWT
# revocation, the SECRET_KEY startup check, and free-text XSS sanitization.


def test_rate_limiter_unit_logic():
    """Unit-tests core/rate_limit.py directly -- no HTTP involved, zero risk of
    polluting shared login-rate-limiter state other tests in this session rely on."""
    from core.rate_limit import InMemoryRateLimiter

    limiter = InMemoryRateLimiter(max_attempts=3, window_seconds=60)
    assert limiter.check_and_record("key-a") is True
    assert limiter.check_and_record("key-a") is True
    assert limiter.check_and_record("key-a") is True
    assert limiter.check_and_record("key-a") is False  # 4th attempt within the window

    # A different key is unaffected.
    assert limiter.check_and_record("key-b") is True

    # Reset clears it.
    limiter.reset("key-a")
    assert limiter.check_and_record("key-a") is True


def test_login_rate_limit_blocks_after_max_attempts(client):
    """End-to-end through the real /api/auth/login endpoint. Uses a dedicated,
    never-reused-elsewhere username so this can't collide with other tests' logins,
    and explicitly clears the module-level limiter state afterward (the IP-based
    limiter is shared across every login in this session -- TestClient always
    presents the same fake client IP) so this doesn't lock out any test that runs
    after it, regardless of collection order."""
    from routers.auth import _ip_limiter, _username_limiter
    from core.config import LOGIN_RATE_LIMIT_MAX_ATTEMPTS

    try:
        bad_login = {"username": "rate-limit-test-user", "password": "wrong-password"}
        for _ in range(LOGIN_RATE_LIMIT_MAX_ATTEMPTS):
            resp = client.post("/api/auth/login", json=bad_login)
            assert resp.status_code == 401  # wrong password, but not yet rate-limited

        resp = client.post("/api/auth/login", json=bad_login)
        assert resp.status_code == 429
        assert "Too many" in resp.json()["detail"]
    finally:
        _ip_limiter._attempts.clear()
        _username_limiter._attempts.clear()


def test_successful_login_resets_rate_limit(client):
    """A legitimate user isn't penalized by their own earlier typos once they get it right."""
    from routers.auth import _ip_limiter, _username_limiter

    try:
        admin_login = {"username": "admin", "password": "wrong-once"}
        client.post("/api/auth/login", json=admin_login)  # one failed attempt

        resp = client.post("/api/auth/login", json={"username": "admin", "password": "test-admin-pass"})
        assert resp.status_code == 200  # succeeds, and resets both limiters for this identity
    finally:
        _ip_limiter._attempts.clear()
        _username_limiter._attempts.clear()


def test_logout_revokes_token(client):
    """docs/backend.md §7.1/§12.6 -- a logged-out token must be rejected immediately,
    not just eventually expire.

    Deliberately does its OWN fresh login rather than using the shared `auth_headers`
    fixture: that fixture wraps the session-scoped `admin_token` reused by every other
    test in this run, and each login issues a token with a unique jti (core/security.py)
    -- revoking *this* dedicated token doesn't touch the shared one, so this test can't
    break anything that runs after it. (Learned this the hard way: revoking the shared
    token here broke every other test needing auth_headers until this fix.)"""
    from routers.auth import _ip_limiter, _username_limiter

    login = client.post("/api/auth/login", json={"username": "admin", "password": "test-admin-pass"})
    assert login.status_code == 200
    _ip_limiter._attempts.clear()
    _username_limiter._attempts.clear()  # this successful login already self-resets, but be explicit
    dedicated_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    resp = client.get("/api/auth/me", headers=dedicated_headers)
    assert resp.status_code == 200

    resp = client.post("/api/auth/logout", headers=dedicated_headers)
    assert resp.status_code == 200

    # The exact same (dedicated) token must now be rejected.
    resp = client.get("/api/auth/me", headers=dedicated_headers)
    assert resp.status_code == 401
    assert "revoked" in resp.json()["detail"].lower()


def test_logout_without_token_rejected(client):
    resp = client.post("/api/auth/logout")
    assert resp.status_code == 401


def test_secret_key_startup_check_blocks_live_with_default_secret(monkeypatch):
    """Fails loudly rather than silently running LIVE on a known-insecure default --
    tested directly against the check function since actually booting a second app
    instance per-scenario isn't practical with this session-scoped test setup."""
    import main

    monkeypatch.setattr(main, "APP_MODE", "LIVE")
    monkeypatch.setattr(main, "SECRET_KEY", main.DEFAULT_INSECURE_SECRET_KEY)
    try:
        main._refuse_insecure_live_deployment()
        assert False, "expected RuntimeError"
    except RuntimeError as e:
        assert "SECRET_KEY" in str(e)


def test_secret_key_startup_check_allows_live_with_real_secret(monkeypatch):
    import main

    monkeypatch.setattr(main, "APP_MODE", "LIVE")
    monkeypatch.setattr(main, "SECRET_KEY", "a-real-secret-someone-actually-set")
    main._refuse_insecure_live_deployment()  # must not raise


def test_secret_key_startup_check_allows_demo_with_default_secret(monkeypatch):
    """DEMO mode is unaffected -- this backend's actual current deployment mode."""
    import main

    monkeypatch.setattr(main, "APP_MODE", "DEMO")
    monkeypatch.setattr(main, "SECRET_KEY", main.DEFAULT_INSECURE_SECRET_KEY)
    main._refuse_insecure_live_deployment()  # must not raise


def test_camera_name_html_tags_stripped(client, auth_headers):
    """docs/backend.md §7.1/§12.6 -- strips markup at the input boundary rather than
    HTML-escaping it (see core/sanitize.py's docstring for why)."""
    cam = {
        "camera_uid": "CAM-XSS-TEST-001",
        "name": "<script>alert(1)</script>Junction Camera",
        "department": "Police",
        "district": "Ahmedabad",
        "location": "<img src=x onerror=alert(1)>Main Road",
        "vms_vendor": "Test",
        "protocol_type": "RTSP",
        "status": "ACTIVE",
        "ai_enabled": False,
    }
    resp = client.post("/api/cameras/", json=cam, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert "<script>" not in body["name"]
    assert "alert(1)Junction Camera" == body["name"]
    assert "<img" not in body["location"]
    assert "Main Road" in body["location"]


def test_watchlist_description_html_tags_stripped(client, auth_headers):
    entry = {
        "identifier": "GJXSS0001",
        "category": "CUSTOM",
        "description": "<b>bold</b> suspicious <script>evil()</script>vehicle",
    }
    resp = client.post("/api/watchlists/", json=entry, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    assert "<script>" not in resp.json()["description"]
    assert "<b>" not in resp.json()["description"]


def test_investigation_title_html_tags_stripped(client, auth_headers):
    case = {"title": "<svg onload=alert(1)>Suspicious vehicle case", "entity": "GJ00XSS001"}
    resp = client.post("/api/investigations/", json=case, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    assert "<svg" not in resp.json()["title"]
    assert "Suspicious vehicle case" in resp.json()["title"]
