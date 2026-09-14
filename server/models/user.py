# User + Role tables for RBAC -- docs/backend.md §7/§12.4. Built alongside real auth
# (core/security.py) during the docs/backend.md §12.4 build-out.
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func

from db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    # ADMIN sees every department; OPERATOR is restricted to department_scope --
    # docs/frontend.md §3.7's "role-based search" requirement.
    role = Column(String, nullable=False, default="OPERATOR")  # ADMIN | OPERATOR
    department_scope = Column(String, nullable=True)  # null for ADMIN (all departments)
    active = Column(Boolean, default=True, nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class AuditLogEntry(Base):
    """Append-only audit log -- docs/frontend.md §3.8, docs/backend.md §7. Every alert
    view/case action/config change should write one of these; not yet wired into every
    call site (docs/backend.md §12), but the table and the log_action() helper
    (core/security.py) are real."""

    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    username = Column(String, nullable=True)  # denormalized so entries survive user deletion
    action = Column(String, nullable=False)  # e.g. ALERT_ACKNOWLEDGED, CAMERA_CREATED, FACIAL_RECOGNITION_AUTHORIZED
    resource_type = Column(String, nullable=True)
    resource_id = Column(String, nullable=True)
    detail = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class RevokedToken(Base):
    """JWT revocation/blocklist -- docs/backend.md §7.1/§12.6. A JWT is normally valid
    until it naturally expires (JWT_EXPIRE_MINUTES); this table lets a specific token
    be invalidated early (logout, a compromised token) by its `jti` claim.
    core/security.get_current_user() checks this on every request. Expired rows are
    safe to delete (a naturally-expired token needs no entry to be rejected) -- see
    core/security.purge_expired_revocations()."""

    __tablename__ = "revoked_tokens"

    jti = Column(String, primary_key=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), server_default=func.now())
