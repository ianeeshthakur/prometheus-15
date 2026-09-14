# Pydantic schemas for users + audit log -- docs/backend.md §7/§12.4.
from pydantic import BaseModel, ConfigDict
from typing import Optional
from enum import Enum

from schemas.common import UtcDatetime


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    OPERATOR = "OPERATOR"


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    role: UserRole = UserRole.OPERATOR
    department_scope: Optional[str] = None  # required in practice for OPERATOR; not DB-enforced yet


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    role: UserRole
    department_scope: Optional[str] = None
    active: bool
    last_login: Optional[UtcDatetime] = None
    created_at: UtcDatetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    detail: Optional[str] = None
    created_at: UtcDatetime

    model_config = ConfigDict(from_attributes=True)
