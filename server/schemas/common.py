# Shared response-schema helpers.
#
# UtcDatetime fixes a real, systemic bug found 2026-09-14 by actually running client/
# against server/ and watching a just-created alert display as "331 min ago": SQLite
# (docs/backend.md's dev DB) has no real timezone-aware storage, so every
# `DateTime(timezone=True)` column (models/*.py) comes back from a query as a naive
# Python datetime that IS UTC in value but carries no tzinfo saying so. Pydantic then
# serializes it with no 'Z'/offset suffix (e.g. "2026-09-14T05:39:42"), and
# `new Date(...)` in every browser silently parses that as LOCAL time, not UTC --
# every relative ("X min ago") and absolute timestamp anywhere in client/ was off by
# exactly the viewer's UTC offset (330 minutes for IST). Postgres (the planned
# production DB, backend.md §4) wouldn't have this specific problem since it returns
# real tz-aware datetimes -- but fixing it only for Postgres would leave SQLite dev
# silently wrong, and dev is what's actually being judged during the hackathon's
# sandbox round. Attaches UTC explicitly at the Pydantic validation layer (runs
# whether the value came from SQLite or Postgres) rather than trying to fix every
# datetime column's storage/read path individually.
from datetime import datetime, timezone
from typing import Annotated
from pydantic import AfterValidator


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


UtcDatetime = Annotated[datetime, AfterValidator(_ensure_utc)]
