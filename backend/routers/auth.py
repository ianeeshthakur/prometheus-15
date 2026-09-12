# /api/auth -- login/session issuance, user management. Built during the
# docs/backend.md §12.4 build-out; rate limiting + logout/revocation added §12.6.
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import List

from db.database import get_db
import services.user_service as user_service
from schemas.auth import LoginRequest, TokenResponse
from schemas.user import UserCreate, UserResponse
from core.security import (
    create_access_token,
    get_current_user,
    get_current_token_claims,
    require_admin,
    log_action,
    revoke_token,
)
from core.rate_limit import InMemoryRateLimiter
from core.config import LOGIN_RATE_LIMIT_MAX_ATTEMPTS, LOGIN_RATE_LIMIT_WINDOW_SECONDS
from models.user import User

router = APIRouter()

# Two limiters, not one: per-IP catches one source hammering many accounts; per-username
# catches a distributed attack against one account from many sources. Either tripping
# blocks the attempt. See core/rate_limit.py's module docstring for the in-process
# (not cross-instance) limitation.
_ip_limiter = InMemoryRateLimiter(LOGIN_RATE_LIMIT_MAX_ATTEMPTS, LOGIN_RATE_LIMIT_WINDOW_SECONDS)
_username_limiter = InMemoryRateLimiter(LOGIN_RATE_LIMIT_MAX_ATTEMPTS, LOGIN_RATE_LIMIT_WINDOW_SECONDS)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"

    if not _ip_limiter.check_and_record(client_ip) or not _username_limiter.check_and_record(payload.username):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts. Try again in up to {LOGIN_RATE_LIMIT_WINDOW_SECONDS}s.",
        )

    user = user_service.authenticate(db, payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    # Successful login resets both limiters for this identity -- a legitimate user
    # shouldn't stay penalized by their own earlier typos once they get it right.
    _ip_limiter.reset(client_ip)
    _username_limiter.reset(payload.username)

    log_action("USER_LOGIN", user=user, resource_type="user", resource_id=str(user.id), db=db)
    return TokenResponse(access_token=create_access_token(user))


@router.post("/logout")
async def logout(
    claims: dict = Depends(get_current_token_claims),
    db: Session = Depends(get_db),
):
    """Revokes the current token -- docs/backend.md §7.1/§12.6, closes the "no JWT
    revocation" gap. The token stays cryptographically valid until it naturally
    expires; this blocklists its `jti` so get_current_user rejects it early."""
    jti = claims.get("jti")
    exp = claims.get("exp")
    if not jti or not exp:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token has no jti/exp claim to revoke")
    revoke_token(db, jti, datetime.fromtimestamp(exp, tz=timezone.utc))
    return {"status": "success", "message": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if user_service.get_by_username(db, user_in.username):
        raise HTTPException(status_code=409, detail="Username already exists")
    new_user = user_service.create_user(db, user_in)
    log_action(
        "USER_CREATED", user=admin, resource_type="user", resource_id=str(new_user.id),
        detail=f"role={new_user.role}", db=db,
    )
    return new_user


@router.get("/users", response_model=List[UserResponse])
async def list_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return user_service.list_users(db)
