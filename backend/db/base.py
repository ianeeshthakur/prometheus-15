# Declarative base, split out from database.py so models/*.py can import it without
# also importing the engine/session (avoids a circular import once every models/*.py
# file is populated). Ported from contrib/aneesh/backend/db.py.
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()
