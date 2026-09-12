# Auth + RBAC + audit logging -- docs/backend.md §7. Built during the §12.4 build-out;
# previously this file only documented the policy.
#
# What's real: password hashing (passlib/bcrypt), JWT issuance/verification (pyjwt),
# FastAPI dependencies for "who is this" and "are they allowed to do this", and an
# audit-log helper. What's NOT wired everywhere yet: most routers don't call these
# dependencies -- see docs/backend.md §12 for which ones do.
#
# The one thing that predates this file and is unrelated to auth: no raw camera IP/RTSP
# URL ever reaches a frontend-facing response. That's still enforced ad-hoc by omission
# -- schemas.camera.CameraResponse simply has no rtsp_url field.
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from core.config import SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_MINUTES
from db.database import get_db, SessionLocal
from models.user import User, AuditLogEntry

logger = logging.getLogger(__name__)

_bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    # bcrypt directly, not passlib -- see requirements.txt's comment for why.
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(user: User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {"sub": str(user.id), "username": user.username, "role": user.role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


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
