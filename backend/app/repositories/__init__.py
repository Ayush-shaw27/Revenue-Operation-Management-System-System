"""Repository layer.

Thin, typed SQLAlchemy helpers for the domain entities.  The service layer
(``app.services.data_store``) composes these with business rules and event
publishing so routes stay slim.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.database.connection import (
    User, Lead, Deal, Account, Activity, Notification, Alert,
    AuditLog, ModelRegistry, MetricSnapshot, get_session,
)


def _to_dict(model) -> Dict[str, Any]:
    import datetime
    result: Dict[str, Any] = {}
    for col in model.__table__.columns:
        val = getattr(model, col.name)
        if isinstance(val, (datetime.datetime, datetime.date)):
            val = val.isoformat()
        result[col.name] = val
    return result


# ---------------------------------------------------------------------------
# Generic CRUD helpers
# ---------------------------------------------------------------------------
def list_all(model, order_by=None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    with get_session() as session:
        q = session.query(model)
        if order_by is not None:
            q = q.order_by(order_by)
        if limit:
            q = q.limit(limit)
        return [_to_dict(r) for r in q.all()]


def get_by_id(model, entity_id: str) -> Optional[Dict[str, Any]]:
    with get_session() as session:
        row = session.get(model, entity_id)
        return _to_dict(row) if row else None


def create(model, **fields) -> Dict[str, Any]:
    with get_session() as session:
        row = model(**fields)
        session.add(row)
        session.flush()
        return _to_dict(row)


def update(entity, entity_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    with get_session() as session:
        row = session.get(entity, entity_id)
        if not row:
            return None
        for k, v in data.items():
            if v is not None and hasattr(row, k):
                setattr(row, k, v)
        session.flush()
        return _to_dict(row)


def delete(entity, entity_id: str) -> bool:
    with get_session() as session:
        row = session.get(entity, entity_id)
        if not row:
            return False
        session.delete(row)
        return True


# ---------------------------------------------------------------------------
# Convenience queries used by services
# ---------------------------------------------------------------------------
def get_user_by_email_or_id(email_or_id: str) -> Optional[Dict[str, Any]]:
    with get_session() as session:
        row = session.query(User).filter(
            (User.id == email_or_id) | (User.email == email_or_id)
        ).first()
        return _to_dict(row) if row else None


def get_deals_where_closed() -> List[Dict[str, Any]]:
    with get_session() as session:
        rows = session.query(Deal).filter(Deal.stage == "closed-won").all()
        return [_to_dict(r) for r in rows]


def touch_login(user_id: str) -> None:
    with get_session() as session:
        row = session.get(User, user_id)
        if row:
            import datetime
            row.last_login = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


def get_property_snapshots(metric_name: str, limit: int = 90) -> List[Dict[str, Any]]:
    with get_session() as session:
        rows = session.query(MetricSnapshot).filter(
            MetricSnapshot.metric_name == metric_name
        ).order_by(MetricSnapshot.snapshot_at.desc()).limit(limit).all()
        return [_to_dict(r) for r in rows]