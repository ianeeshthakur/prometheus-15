# User CRUD -- docs/backend.md §7/§12.4.
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session

from models.user import User
from schemas.user import UserCreate
from core.security import hash_password, verify_password


def get_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def create_user(db: Session, user_in: UserCreate) -> User:
    db_obj = User(
        username=user_in.username,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        department_scope=user_in.department_scope,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def list_users(db: Session) -> List[User]:
    return db.query(User).all()


def authenticate(db: Session, username: str, password: str) -> Optional[User]:
    user = get_by_username(db, username)
    if not user or not user.active or not verify_password(password, user.hashed_password):
        return None
    user.last_login = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
