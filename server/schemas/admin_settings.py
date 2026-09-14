# Schemas for the facial-recognition authorization gate -- docs/backend.md §12.4.
from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime

from core.sanitize import strip_html_tags


class FacialRecognitionAuthorizeRequest(BaseModel):
    enabled: bool
    reason: str  # required -- no toggling without a stated reason, on or off

    @field_validator("reason")
    @classmethod
    def sanitize_free_text(cls, v):
        # docs/backend.md §7.1/§12.6 -- see core/sanitize.py's module docstring.
        return strip_html_tags(v)


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
