"""backend/data_store.py
SQLAlchemy-backed persistence layer.  Maintains the exact same function
signatures as the original in-memory version so routes in main.py, alert_engine,
and auth need ZERO changes.

Swapping this for Postgres = change DATABASE_URL env var only.
"""
import ast
import datetime
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.db import (
    User as UserModel, Lead as LeadModel, Deal as DealModel,
    Account as AccountModel, Activity as ActivityModel,
    Notification as NotificationModel, Alert as AlertModel,
    AuditLog as AuditLogModel, ModelRegistry as ModelRegistryModel,
    MetricSnapshot as MetricSnapshotModel,
    get_session,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _now() -> str:
    return datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


def _model_to_dict(model) -> Dict[str, Any]:
    result = {}
    for col in model.__table__.columns:
        val = getattr(model, col.name)
        if isinstance(val, (datetime.datetime, datetime.date)):
            val = val.isoformat() if hasattr(val, 'isoformat') else str(val)
        result[col.name] = val
    return result


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
def get_user(email_or_id: str) -> Optional[Dict[str, Any]]:
    with get_session() as session:
        user = session.query(UserModel).filter(
            (UserModel.id == email_or_id) | (UserModel.email == email_or_id)
        ).first()
        if user:
            return _model_to_dict(user)
    return None


def verify_user_password(username: str, plain_password: str) -> bool:
    from backend.auth import verify_password
    user = get_user(username)
    if not user:
        return False
    return verify_password(plain_password, user["hashed_password"])


def create_user(data: Dict[str, Any]) -> Dict[str, Any]:
    from backend.auth import get_password_hash
    user_id = f"u{uuid.uuid4().hex[:8]}"
    with get_session() as session:
        user = UserModel(
            id=user_id,
            name=data["name"],
            email=data["email"],
            hashed_password=get_password_hash(data["password"]),
            role=data.get("role", "sales-executive"),
            status="active",
            last_login=_now(),
            created_at=datetime.datetime.utcnow().strftime("%Y-%m-%d"),
        )
        session.add(user)
        session.flush()
        result = _model_to_dict(user)
    return result


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    return get_user(user_id)


def list_users() -> List[Dict[str, Any]]:
    with get_session() as session:
        return [_model_to_dict(u) for u in session.query(UserModel).all()]


def update_user(user_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    from backend.auth import get_password_hash
    with get_session() as session:
        user = session.query(UserModel).filter(UserModel.id == user_id).first()
        if not user:
            return None
        if "password" in data and data["password"]:
            user.hashed_password = get_password_hash(data["password"])
            del data["password"]
        for k, v in data.items():
            if v is not None and hasattr(user, k):
                setattr(user, k, v)
        session.flush()
        return _model_to_dict(user)


def delete_user(user_id: str) -> bool:
    with get_session() as session:
        user = session.query(UserModel).filter(UserModel.id == user_id).first()
        if not user:
            return False
        session.delete(user)
    return True


def touch_login(user_id: str) -> None:
    with get_session() as session:
        user = session.query(UserModel).filter(UserModel.id == user_id).first()
        if user:
            user.last_login = _now()


# ---------------------------------------------------------------------------
# Leads
# ---------------------------------------------------------------------------
def get_leads() -> List[Dict[str, Any]]:
    with get_session() as session:
        return [_lead_to_dict(u) for u in session.query(LeadModel).all()]


def get_lead(lead_id: str) -> Optional[Dict[str, Any]]:
    with get_session() as session:
        lead = session.query(LeadModel).filter(LeadModel.id == lead_id).first()
        if lead:
            return _lead_to_dict(lead)
    return None


def _lead_to_dict(lead: LeadModel) -> Dict[str, Any]:
    result = _model_to_dict(lead)
    if result.get("ai_factors") and isinstance(result["ai_factors"], str):
        try:
            result["ai_factors"] = ast.literal_eval(result["ai_factors"])
        except Exception:
            result["ai_factors"] = [result["ai_factors"]]
    return result


def create_lead(data: Dict[str, Any]) -> Dict[str, Any]:
    lead_id = f"l{uuid.uuid4().hex[:8]}"
    with get_session() as session:
        lead = LeadModel(
            id=lead_id,
            name=data.get("name", ""),
            email=data.get("email", ""),
            phone=data.get("phone", ""),
            company=data["company"],
            status=data.get("status", "new"),
            source=data.get("source", "Website"),
            value=float(data.get("value", 0)),
            industry=data.get("industry", "Technology"),
            company_size=data.get("company_size", "Mid-Market"),
            touchpoints=int(data.get("touchpoints", 3)),
            notes=data.get("notes", ""),
            created_at=_now(),
            ai_score=data.get("ai_score"),
            ai_label=data.get("ai_label"),
            ai_factors=data.get("ai_factors"),
        )
        session.add(lead)
        session.flush()
        result = _lead_to_dict(lead)

    _snapshot("leads_total", 1)
    _log_activity("System", "Lead Added", data.get("company", "New Lead"), "lead")
    _publish("leads", "created", result)
    return result


def update_lead(lead_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    with get_session() as session:
        lead = session.query(LeadModel).filter(LeadModel.id == lead_id).first()
        if not lead:
            return None
        previous_status = lead.status
        for k, v in data.items():
            if v is not None and hasattr(lead, k):
                setattr(lead, k, v)
        session.flush()
        result = _lead_to_dict(lead)

    if data.get("status") and data["status"] != previous_status:
        add_activity(lead_id=lead_id, type="stage_change",
                     content=f"Status changed to {data['status']}", author="System")
    _publish("leads", "updated", result)
    return result


def delete_lead(lead_id: str) -> bool:
    with get_session() as session:
        lead = session.query(LeadModel).filter(LeadModel.id == lead_id).first()
        if not lead:
            return False
        session.query(ActivityModel).filter(ActivityModel.lead_id == lead_id).delete()
        session.delete(lead)
    _publish("leads", "deleted", {"id": lead_id})
    return True


# ---------------------------------------------------------------------------
# Deals
# ---------------------------------------------------------------------------
def get_deals() -> List[Dict[str, Any]]:
    with get_session() as session:
        return [_model_to_dict(d) for d in session.query(DealModel).all()]


def get_deal(deal_id: str) -> Optional[Dict[str, Any]]:
    with get_session() as session:
        deal = session.query(DealModel).filter(DealModel.id == deal_id).first()
        if deal:
            return _model_to_dict(deal)
    return None


def create_deal(data: Dict[str, Any]) -> Dict[str, Any]:
    deal_id = f"d{uuid.uuid4().hex[:8]}"
    with get_session() as session:
        deal = DealModel(
            id=deal_id,
            title=data.get("title", ""),
            company=data.get("company", ""),
            value=float(data.get("value", 0)),
            probability=int(data.get("probability", 50)),
            owner=data.get("owner", "System"),
            close_date=data.get("close_date"),
            stage=data.get("stage", "prospecting"),
            ai_recommendation=data.get("ai_recommendation"),
            is_anomalous=data.get("is_anomalous", False),
            days_in_stage=int(data.get("days_in_stage", 0)),
            last_stage_change=None,
            created_at=_now(),
        )
        session.add(deal)
        session.flush()
        result = _model_to_dict(deal)

    _snapshot("deals_total", 1)
    _log_activity("System", "Deal Created", data.get("title", "New Deal"), "pipeline")
    _publish("deals", "created", result)
    return result


def update_deal(deal_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    with get_session() as session:
        deal = session.query(DealModel).filter(DealModel.id == deal_id).first()
        if not deal:
            return None
        previous_stage = deal.stage
        for k, v in data.items():
            if v is not None and hasattr(deal, k):
                setattr(deal, k, v)
        if data.get("stage") and data["stage"] != previous_stage:
            deal.days_in_stage = 0
            deal.last_stage_change = _now()
            add_activity(deal_id=deal_id, type="stage_change",
                         content=f"Stage changed to {data['stage']}", author="System")
        session.flush()
        result = _model_to_dict(deal)

    _publish("deals", "updated", result)
    return result


def delete_deal(deal_id: str) -> bool:
    with get_session() as session:
        deal = session.query(DealModel).filter(DealModel.id == deal_id).first()
        if not deal:
            return False
        session.query(ActivityModel).filter(ActivityModel.deal_id == deal_id).delete()
        session.delete(deal)
    _publish("deals", "deleted", {"id": deal_id})
    return True


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------
def get_accounts() -> List[Dict[str, Any]]:
    with get_session() as session:
        return [_model_to_dict(a) for a in session.query(AccountModel).all()]


def get_account(account_id: str) -> Optional[Dict[str, Any]]:
    with get_session() as session:
        account = session.query(AccountModel).filter(AccountModel.id == account_id).first()
        if account:
            return _model_to_dict(account)
    return None


def create_account(data: Dict[str, Any]) -> Dict[str, Any]:
    account_id = f"c{uuid.uuid4().hex[:8]}"
    with get_session() as session:
        account = AccountModel(
            id=account_id,
            name=data.get("name", ""),
            industry=data.get("industry", "Technology"),
            contract_value=float(data.get("contract_value", 0)),
            last_activity_days=int(data.get("last_activity_days", 30)),
            usage_trend=float(data.get("usage_trend", 0.0)),
            ticket_count=int(data.get("ticket_count", 0)),
            renewal_in_days=int(data.get("renewal_in_days", 90)),
            health_score=float(data.get("health_score", 0.5)),
        )
        session.add(account)
        session.flush()
        result = _model_to_dict(account)
    return result


def update_account(account_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    with get_session() as session:
        account = session.query(AccountModel).filter(AccountModel.id == account_id).first()
        if not account:
            return None
        for k, v in data.items():
            if v is not None and hasattr(account, k):
                setattr(account, k, v)
        session.flush()
        return _model_to_dict(account)


def delete_account(account_id: str) -> bool:
    with get_session() as session:
        account = session.query(AccountModel).filter(AccountModel.id == account_id).first()
        if not account:
            return False
        session.delete(account)
    return True


# ---------------------------------------------------------------------------
# Activities
# ---------------------------------------------------------------------------
def get_activities(deal_id: Optional[str] = None, lead_id: Optional[str] = None,
                   limit: int = 50) -> List[Dict[str, Any]]:
    with get_session() as session:
        q = session.query(ActivityModel)
        if deal_id:
            q = q.filter(ActivityModel.deal_id == deal_id)
        if lead_id:
            q = q.filter(ActivityModel.lead_id == lead_id)
        results = q.order_by(ActivityModel.created_at.desc()).limit(limit).all()
        return [_model_to_dict(a) for a in results]


def add_activity(*, deal_id: Optional[str] = None, lead_id: Optional[str] = None,
                 type: str, content: str, author: str) -> Dict[str, Any]:
    activity_id = f"ac{uuid.uuid4().hex[:8]}"
    with get_session() as session:
        activity = ActivityModel(
            id=activity_id,
            deal_id=deal_id,
            lead_id=lead_id,
            type=type,
            author=author,
            content=content,
            created_at=_now(),
        )
        session.add(activity)
        session.flush()
        return _model_to_dict(activity)


def update_activity(activity_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    with get_session() as session:
        activity = session.query(ActivityModel).filter(ActivityModel.id == activity_id).first()
        if not activity:
            return None
        for k, v in data.items():
            if v is not None and hasattr(activity, k):
                setattr(activity, k, v)
        session.flush()
        return _model_to_dict(activity)


def delete_activity(activity_id: str) -> bool:
    with get_session() as session:
        activity = session.query(ActivityModel).filter(ActivityModel.id == activity_id).first()
        if not activity:
            return False
        session.delete(activity)
    return True


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
def get_notifications() -> List[Dict[str, Any]]:
    with get_session() as session:
        results = session.query(NotificationModel).order_by(NotificationModel.created_at.desc()).all()
        return [_model_to_dict(n) for n in results]


def get_unread_notification_count() -> int:
    with get_session() as session:
        return session.query(NotificationModel).filter(NotificationModel.read == False).count()


def mark_notification_read(notif_id: str) -> bool:
    with get_session() as session:
        notif = session.query(NotificationModel).filter(NotificationModel.id == notif_id).first()
        if not notif:
            return False
        notif.read = True
    return True


def mark_all_notifications_read() -> int:
    with get_session() as session:
        count = session.query(NotificationModel).filter(NotificationModel.read == False).count()
        session.query(NotificationModel).filter(NotificationModel.read == False).update({"read": True})
    return count


def add_notification(type_: str, title: str, message: str) -> None:
    notif_id = f"n{uuid.uuid4().hex[:8]}"
    with get_session() as session:
        notif = NotificationModel(
            id=notif_id, type=type_, title=title,
            message=message, read=False, created_at=_now(),
        )
        session.add(notif)
    _publish("notifications", "created", {"id": notif_id, "type": type_, "title": title, "message": message, "read": False, "created_at": _now()})


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------
_ALERTS_CACHE: List[Dict[str, Any]] = []  # lightweight in-process cache for replace_alerts


def get_alerts() -> List[Dict[str, Any]]:
    with get_session() as session:
        results = session.query(AlertModel).order_by(AlertModel.created_at.desc()).all()
        return [_model_to_dict(a) for a in results]


def get_unread_alert_count() -> int:
    with get_session() as session:
        return session.query(AlertModel).filter(AlertModel.read == False).count()


def add_alert(kind: str, severity: str, entity_type: str, entity_id: str,
              entity_name: str, summary: str) -> Dict[str, Any]:
    alert_id = f"al{uuid.uuid4().hex[:8]}"
    created = _now()
    with get_session() as session:
        alert = AlertModel(
            id=alert_id, kind=kind, severity=severity,
            entity_type=entity_type, entity_id=entity_id,
            entity_name=entity_name, summary=summary,
            read=False, created_at=created,
        )
        session.add(alert)
        session.flush()
        result = _model_to_dict(alert)
    _publish("alerts", "created", result)
    return result


def replace_alerts(alerts: List[Dict[str, Any]]) -> None:
    global _ALERTS_CACHE
    read_keys = {(a["kind"], a["entity_id"]) for a in _ALERTS_CACHE if a.get("read")}
    for a in alerts:
        if (a["kind"], a["entity_id"]) in read_keys:
            a["read"] = True
    _ALERTS_CACHE = alerts
    with get_session() as session:
        session.query(AlertModel).delete()
        for a in alerts:
            session.add(AlertModel(
                id=a.get("id", f"al{uuid.uuid4().hex[:8]}"),
                kind=a["kind"], severity=a.get("severity", "medium"),
                entity_type=a["entity_type"], entity_id=a["entity_id"],
                entity_name=a.get("entity_name", ""), summary=a.get("summary", ""),
                read=a.get("read", False),
                created_at=a.get("created_at", _now()),
            ))
    _publish("alerts", "regenerated", {"count": len(alerts)})


def mark_alert_read(alert_id: str) -> bool:
    with get_session() as session:
        alert = session.query(AlertModel).filter(AlertModel.id == alert_id).first()
        if not alert:
            return False
        alert.read = True
    return True


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------
def get_activity(limit: int = 20) -> List[Dict[str, Any]]:
    with get_session() as session:
        results = session.query(AuditLogModel).order_by(AuditLogModel.timestamp.desc()).limit(limit).all()
        return [_model_to_dict(a) for a in results]


def _log_activity(user: str, action: str, resource: str, type_: str) -> None:
    activity_id = f"a{uuid.uuid4().hex[:8]}"
    with get_session() as session:
        session.add(AuditLogModel(
            id=activity_id, user=user, action=action,
            resource=resource, type=type_,
            timestamp=_now(), ip="127.0.0.1",
        ))


# ---------------------------------------------------------------------------
# Model registry
# ---------------------------------------------------------------------------
def get_model_registry() -> Dict[str, Dict[str, Any]]:
    with get_session() as session:
        entries = session.query(ModelRegistryModel).all()
        return {e.name: _model_to_dict(e) for e in entries}


def register_model(name: str, version: str, trained_at: str, accuracy: float,
                   kind: str, notes: str = "") -> Dict[str, Any]:
    with get_session() as session:
        existing = session.query(ModelRegistryModel).filter(ModelRegistryModel.name == name).first()
        if existing:
            existing.version = version
            existing.trained_at = trained_at
            existing.accuracy = accuracy
            existing.kind = kind
            existing.notes = notes
            session.flush()
            return _model_to_dict(existing)
        entry = ModelRegistryModel(
            name=name, version=version, trained_at=trained_at,
            accuracy=accuracy, kind=kind, notes=notes,
        )
        session.add(entry)
        session.flush()
        return _model_to_dict(entry)


# ---------------------------------------------------------------------------
# MetricSnapshots (for trend % computation)
# ---------------------------------------------------------------------------
def _snapshot(metric_name: str, value: float) -> None:
    with get_session() as session:
        session.add(MetricSnapshotModel(
            metric_name=metric_name,
            value=value,
            snapshot_at=datetime.datetime.utcnow(),
        ))


# ---------------------------------------------------------------------------
# Real-time publish stub (Phase 4 wires this to EventBus)
# ---------------------------------------------------------------------------
def _publish(channel: str, event: str, data: Any) -> None:
    try:
        from backend.realtime import event_bus
        event_bus.publish(channel, {"event": event, "data": data})
    except Exception:
        pass
