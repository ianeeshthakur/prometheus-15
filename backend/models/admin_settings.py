# Facial-recognition authorization gate -- docs/backend.md §7/§12.4, the differentiator
# from docs/prd.md §13.2: "a real toggle/audit entry in Administration, not just a PRD
# sentence." Each row is one authorization *event* (grant or revoke), not a single
# mutable flag -- the current state is the most recent row, and the table itself IS
# the audit trail, matching the DPDP Act 2023 / Puttaswamy-judgment requirement that
# this capability stay explicit and accountable, never a silent default.
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func

from db.base import Base


class FacialRecognitionAuthorization(Base):
    __tablename__ = "facial_recognition_authorizations"

    id = Column(Integer, primary_key=True, index=True)
    enabled = Column(Boolean, nullable=False)
    authorized_by = Column(String, nullable=False)
    reason = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
