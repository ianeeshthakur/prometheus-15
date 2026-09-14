# Engine/session setup. Ported from contrib/aneesh/backend/db.py, adapted to read
# DATABASE_URL from core.config instead of os.environ directly, and to import Base
# from db.base (see that file for why it's split out).
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.config import DATABASE_URL
from .base import Base

# connect_args={"check_same_thread": False} is needed only for SQLite.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
