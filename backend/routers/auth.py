# /api/auth -- login/session issuance, user management. Built during the
# docs/backend.md §12.4 build-out.
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from db.database import get_db
import services.user_service as user_service
from schemas.auth import LoginRequest, TokenResponse
from schemas.user import UserCreate, UserResponse
from core.security import create_access_token, get_current_user, require_admin, log_action
from models.user import User

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = user_service.authenticate(db, payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    log_action("USER_LOGIN", user=user, resource_type="user", resource_id=str(user.id), db=db)
    return TokenResponse(access_token=create_access_token(user))


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
