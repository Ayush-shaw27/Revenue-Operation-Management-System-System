"""backend/db.py
SQLAlchemy engine, ORM models, session management, and table init.

SQLite by default (backend/revops.db); swap DATABASE_URL env var for Postgres.
"""
import os
import datetime
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import (
    create_engine,
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    Text,
    JSON,
    event,
)
from sqlalchemy.orm import (
    declarative_base,
    sessionmaker,
    Session,
)

DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    _db_dir = os.path.dirname(os.path.abspath(__file__))
    DATABASE_URL = f"sqlite:///{os.path.join(_db_dir, 'revops.db')}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    pool_pre_ping=True,
    echo=False,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

if "sqlite" in DATABASE_URL:
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


# ---------------------------------------------------------------------------
# ORM Models
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"
    id = Column(String(32), primary_key=True)
    name = Column(String(128), nullable=False)
    email = Column(String(128), unique=True, nullable=False)
    hashed_password = Column(String(256), nullable=False)
    role = Column(String(32), nullable=False, default="sales-executive")
    status = Column(String(16), nullable=False, default="active")
    last_login = Column(String(32), nullable=True)
    created_at = Column(String(32), nullable=True)


class Lead(Base):
    __tablename__ = "leads"
    id = Column(String(32), primary_key=True)
    name = Column(String(128), nullable=False)
    email = Column(String(128), default="")
    phone = Column(String(64), default="")
    company = Column(String(128), nullable=False)
    status = Column(String(32), default="new")
    source = Column(String(64), default="Website")
    value = Column(Float, default=0.0)
    industry = Column(String(64), default="Technology")
    company_size = Column(String(32), default="Mid-Market")
    touchpoints = Column(Integer, default=3)
    notes = Column(Text, default="")
    created_at = Column(String(32), nullable=True)
    ai_score = Column(Integer, nullable=True)
    ai_label = Column(String(16), nullable=True)
    ai_factors = Column(JSON, nullable=True)


class Deal(Base):
    __tablename__ = "deals"
    id = Column(String(32), primary_key=True)
    title = Column(String(256), nullable=False)
    company = Column(String(128), nullable=False)
    value = Column(Float, default=0.0)
    probability = Column(Integer, default=50)
    owner = Column(String(128), default="System")
    close_date = Column(String(32), nullable=True)
    stage = Column(String(32), default="prospecting")
    ai_recommendation = Column(String(256), nullable=True)
    is_anomalous = Column(Boolean, default=False)
    days_in_stage = Column(Integer, default=0)
    last_stage_change = Column(String(32), nullable=True)
    created_at = Column(String(32), nullable=True)


class Account(Base):
    __tablename__ = "accounts"
    id = Column(String(32), primary_key=True)
    name = Column(String(128), nullable=False)
    industry = Column(String(64), default="Technology")
    contract_value = Column(Float, default=0.0)
    last_activity_days = Column(Integer, default=30)
    usage_trend = Column(Float, default=0.0)
    ticket_count = Column(Integer, default=0)
    renewal_in_days = Column(Integer, default=90)
    health_score = Column(Float, default=0.5)


class Activity(Base):
    __tablename__ = "activities"
    id = Column(String(32), primary_key=True)
    deal_id = Column(String(32), nullable=True)
    lead_id = Column(String(32), nullable=True)
    type = Column(String(32), nullable=False)
    author = Column(String(128), nullable=False)
    content = Column(Text, default="")
    created_at = Column(String(32), nullable=True)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String(32), primary_key=True)
    type = Column(String(32), nullable=False)
    title = Column(String(256), nullable=False)
    message = Column(Text, default="")
    read = Column(Boolean, default=False)
    created_at = Column(String(32), nullable=True)


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(String(32), primary_key=True)
    kind = Column(String(32), nullable=False)
    severity = Column(String(16), nullable=False)
    entity_type = Column(String(32), nullable=False)
    entity_id = Column(String(32), nullable=False)
    entity_name = Column(String(128), default="")
    summary = Column(Text, default="")
    read = Column(Boolean, default=False)
    created_at = Column(String(32), nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(String(32), primary_key=True)
    user = Column(String(128), nullable=False)
    action = Column(String(128), nullable=False)
    resource = Column(String(256), default="")
    type = Column(String(32), default="general")
    timestamp = Column(String(32), nullable=True)
    ip = Column(String(64), default="127.0.0.1")


class ModelRegistry(Base):
    __tablename__ = "model_registry"
    name = Column(String(64), primary_key=True)
    version = Column(String(32), nullable=False)
    trained_at = Column(String(32), nullable=False)
    accuracy = Column(Float, default=0.0)
    kind = Column(String(32), default="unknown")
    notes = Column(Text, default="")


class MetricSnapshot(Base):
    __tablename__ = "metric_snapshots"
    id = Column(Integer, primary_key=True, autoincrement=True)
    metric_name = Column(String(64), nullable=False, index=True)
    value = Column(Float, nullable=False)
    snapshot_at = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)


# ---------------------------------------------------------------------------
# Session helper
# ---------------------------------------------------------------------------
@contextmanager
def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db():
    """Create all tables. Called once at startup."""
    Base.metadata.create_all(bind=engine)
