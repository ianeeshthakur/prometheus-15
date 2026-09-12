# Schemas for the facial-recognition authorization gate -- docs/backend.md §12.4.
from pydantic import BaseModel, ConfigDict
from datetime import datetime


class FacialRecognitionAuthorizeRequest(BaseModel):
    enabled: bool
    reason: str  # required -- no toggling without a stated reason, on or off


class FacialRecognitionAuthorizationResponse(BaseModel):
    id: int
    enabled: bool
    authorized_by: str
    reason: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FacialRecognitionStatusResponse(BaseModel):
    currently_enabled: bool
    history: list[FacialRecognitionAuthorizationResponse]
