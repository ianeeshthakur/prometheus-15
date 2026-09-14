# Auth + RBAC + audit logging -- docs/backend.md §7. Built during the §12.4 build-out;
# previously this file only documented the policy. Extended during §12.6 with JWT
# revocation (logout) and rate limiting is in core/rate_limit.py, wired from
# routers/auth.py rather than here.
#
# What's real: password hashing (bcrypt directly), JWT issuance/verification/
# revocation (pyjwt), FastAPI dependencies for "who is this" and "are they allowed to
# do this", and an audit-log helper. What's NOT wired everywhere yet: most read-only
# diagnostic routes don't require auth -- see docs/backend.md §12 for which do.
#
# The one thing that predates this file and is unrelated to auth: no raw camera IP/RTSP
# URL ever reaches a frontend-facing response. That's still enforced ad-hoc by omission
# -- schemas.camera.CameraResponse simply has no rtsp_url field.
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from core.config import SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_MINUTES
from db.database import get_db, SessionLocal
from models.user import User, AuditLogEntry, RevokedToken

logger = logging.getLogger(__name__)

_bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    # bcrypt directly, not passlib -- see requirements.txt's comment for why.
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(user: User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
        "jti": str(uuid.uuid4()),  # unique per token -- what revoke_token() targets
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def is_token_revoked(db: Session, jti: str) -> bool:
    return db.query(RevokedToken).filter(RevokedToken.jti == jti).first() is not None


def revoke_token(db: Session, jti: str, expires_at: datetime) -> None:
    """Blocklists one token by its jti -- docs/backend.md §7.1/§12.6, closes the "no
    JWT revocation" gap. Idempotent (logging out twice with the same token is a no-op,
    not an error). Also opportunistically purges rows whose expiry has already passed
    -- a naturally-expired token needs no blocklist entry (jwt.decode already rejects
    it on its own `exp` claim), so old rows here are pure bloat."""
    if not db.query(RevokedToken).filter(RevokedToken.jti == jti).first():
        db.add(RevokedToken(jti=jti, expires_at=expires_at))
    now = datetime.now(timezone.utc)
    db.query(RevokedToken).filter(RevokedToken.expires_at < now).delete()
    db.commit()


def _resolve_user_from_raw_token(raw_token: Optional[str], db: Session) -> User:
    if raw_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = _decode_token(raw_token)
    try:
        user_id = int(payload["sub"])
        jti = payload["jti"]
    except (KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    if is_token_revoked(db, jti):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    raw_token = credentials.credentials if credentials else None
    return _resolve_user_from_raw_token(raw_token, db)


def get_current_user_header_or_query(
    token: Optional[str] = None,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Same check as get_current_user, plus a `?token=` query-param fallback --
    exists only for GET /api/streams/events/stream. Browsers' native EventSource API
    (used by client/src/api/client.js's subscribeToLiveEvents()) cannot set custom
    request headers at all, so an SSE endpoint that requires Authorization the normal
    way is unreachable from a real browser -- not a workaround for weaker auth, the
    same JWT is still required and still validated (signature, expiry, revocation)
    exactly as through the header path. Every other authenticated route should keep
    using get_current_user (header-only) -- a query-param token is more exposure-prone
    (browser history, server access logs) and should be as narrowly scoped as the one
    real reason it exists here."""
    raw_token = credentials.credentials if credentials else token
    return _resolve_user_from_raw_token(raw_token, db)


def get_current_token_claims(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    """Raw token claims (needs `jti`/`exp` to revoke) rather than the resolved User --
    used only by POST /api/auth/logout. Everything else should depend on
    get_current_user instead."""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return _decode_token(credentials.credentials)


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return user


def require_department_access(department: str, user: User) -> None:
    """Raises 403 if `user` is an OPERATOR scoped to a different department than
    `department`. ADMIN always passes. Call explicitly inside a route (not a
    Depends()) since the department being checked is per-resource, not per-route."""
    if user.role == "ADMIN":
        return
    if user.department_scope and user.department_scope != department:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User is scoped to {user.department_scope}, not {department}",
        )


def log_action(
    action: str,
    user: Optional[User] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    detail: Optional[str] = None,
    db: Optional[Session] = None,
) -> None:
    """Writes one audit-log row. Opens its own short-lived session when `db` isn't
    passed, so callers in background tasks (no request-scoped session available) can
    still log without plumbing a session through."""
    owns_session = db is None
    session = db or SessionLocal()
    try:
        entry = AuditLogEntry(
            user_id=user.id if user else None,
            username=user.username if user else None,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            detail=detail,
        )
        session.add(entry)
        session.commit()
    except Exception as e:
        logger.error(f"Failed to write audit log entry for action={action}: {e}")
        session.rollback()
    finally:
        if owns_session:
            session.close()
