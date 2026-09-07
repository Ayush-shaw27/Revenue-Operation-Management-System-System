"""backend/seed_loader.py
On startup (init_db), if the DB is empty, reads the CSV files from
backend/seed/ and bulk-inserts via SQLAlchemy.
"""
import csv
import os
from typing import List, Dict, Any

from sqlalchemy.orm import Session

from backend.db import (
    User, Lead, Deal, Account, Activity,
    Notification, Alert, AuditLog, ModelRegistry,
    get_session,
)

SEED_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed")


def _read_csv(filename: str) -> List[Dict[str, str]]:
    path = os.path.join(SEED_DIR, filename)
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _import_users(session: Session):
    rows = _read_csv("users.csv")
    for r in rows:
        session.add(User(
            id=r["id"], name=r["name"], email=r["email"],
            hashed_password=r["hashed_password"], role=r["role"],
            status=r.get("status", "active"),
            last_login=r.get("last_login"), created_at=r.get("created_at"),
        ))
    print(f"  Seeded {len(rows)} users")


def _import_leads(session: Session):
    rows = _read_csv("leads.csv")
    for r in rows:
        import ast
        factors = None
        if r.get("ai_factors"):
            try:
                factors = ast.literal_eval(r["ai_factors"])
            except Exception:
                factors = [r["ai_factors"]]
        session.add(Lead(
            id=r["id"], name=r["name"], email=r.get("email", ""),
            phone=r.get("phone", ""), company=r["company"],
            status=r.get("status", "new"), source=r.get("source", "Website"),
            value=float(r.get("value", 0)),
            industry=r.get("industry", "Technology"),
            company_size=r.get("company_size", "Mid-Market"),
            touchpoints=int(r.get("touchpoints", 3)),
            notes=r.get("notes", ""),
            created_at=r.get("created_at"),
            ai_score=int(r["ai_score"]) if r.get("ai_score") else None,
            ai_label=r.get("ai_label") or None,
            ai_factors=factors,
        ))
    print(f"  Seeded {len(rows)} leads")


def _import_deals(session: Session):
    rows = _read_csv("deals.csv")
    for r in rows:
        session.add(Deal(
            id=r["id"], title=r["title"], company=r["company"],
            value=float(r.get("value", 0)),
            probability=int(r.get("probability", 50)),
            owner=r.get("owner", "System"),
            close_date=r.get("close_date"),
            stage=r.get("stage", "prospecting"),
            ai_recommendation=r.get("ai_recommendation") or None,
            is_anomalous=r.get("is_anomalous", "False") == "True",
            days_in_stage=int(r.get("days_in_stage", 0)),
            last_stage_change=r.get("last_stage_change") or None,
            created_at=r.get("created_at"),
        ))
    print(f"  Seeded {len(rows)} deals")


def _import_accounts(session: Session):
    rows = _read_csv("accounts.csv")
    for r in rows:
        session.add(Account(
            id=r["id"], name=r["name"], industry=r.get("industry", "Technology"),
            contract_value=float(r.get("contract_value", 0)),
            last_activity_days=int(r.get("last_activity_days", 30)),
            usage_trend=float(r.get("usage_trend", 0)),
            ticket_count=int(r.get("ticket_count", 0)),
            renewal_in_days=int(r.get("renewal_in_days", 90)),
            health_score=float(r.get("health_score", 0.5)),
        ))
    print(f"  Seeded {len(rows)} accounts")


def _import_activities(session: Session):
    rows = _read_csv("activities.csv")
    for r in rows:
        session.add(Activity(
            id=r["id"],
            deal_id=r.get("deal_id") or None,
            lead_id=r.get("lead_id") or None,
            type=r.get("type", "note"),
            author=r.get("author", "System"),
            content=r.get("content", ""),
            created_at=r.get("created_at"),
        ))
    print(f"  Seeded {len(rows)} activities")


def _seed_demo_notifications(session: Session):
    from backend.db import Notification as NotifModel
    demo = [
        NotifModel(id="n1", type="warning", title="Deal at Risk",
                    message="Digital Transformation has been in Qualification for 31 days — at risk of stalling.",
                    read=False, created_at="2024-01-19 09:00"),
        NotifModel(id="n2", type="success", title="Lead Score Threshold Crossed",
                    message="Mike Chen (Innovate.io) crossed 90% conversion probability.",
                    read=False, created_at="2024-01-19 10:30"),
        NotifModel(id="n3", type="info", title="Forecast Updated",
                    message="Q2 ML revenue forecast revised up by +3.5%.",
                    read=True, created_at="2024-01-18 16:00"),
    ]
    session.add_all(demo)
    print(f"  Seeded {len(demo)} notifications")


def _seed_demo_alerts(session: Session):
    demo = [
        Alert(id="al1", kind="stale_deal", severity="high", entity_type="deal",
              entity_id="d3", entity_name="Digital Transformation",
              summary="No stage change in 31 days (threshold 14).",
              read=False, created_at="2024-01-19 09:00:00"),
        Alert(id="al2", kind="risk_crossing", severity="medium", entity_type="account",
              entity_id="c2", entity_name="TechStart Inc",
              summary="Account entered HIGH churn risk (score 0.71).",
              read=False, created_at="2024-01-19 10:30:00"),
    ]
    session.add_all(demo)
    print(f"  Seeded {len(demo)} alerts")


def _seed_demo_audit(session: Session):
    demo = [
        AuditLog(id="a1", user="Sarah Johnson", action="Lead Scored",
                 resource="Apex Innovations", type="ml", timestamp="2024-01-19 14:30:15", ip="192.168.1.100"),
        AuditLog(id="a2", user="John Smith", action="Deal Moved",
                 resource="Enterprise License → Negotiation", type="pipeline", timestamp="2024-01-19 12:15:30", ip="192.168.1.101"),
        AuditLog(id="a3", user="Mike Chen", action="Forecast Run",
                 resource="Q3 Random Forest", type="forecast", timestamp="2024-01-19 09:45:22", ip="192.168.1.102"),
        AuditLog(id="a4", user="Emily Davis", action="Report Exported",
                 resource="Monthly Sales PDF", type="report", timestamp="2024-01-18 16:20:45", ip="192.168.1.103"),
    ]
    session.add_all(demo)
    print(f"  Seeded {len(demo)} audit log entries")


def _seed_models(session: Session):
    import datetime
    now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    models = [
        ModelRegistry(name="lead_scoring", version="1.0.0", trained_at=now, accuracy=89.0, kind="classifier", notes="RandomForest lead conversion scoring"),
        ModelRegistry(name="revenue_forecast", version="1.0.0", trained_at=now, accuracy=88.0, kind="regressor", notes="Ridge/boosted multi-horizon forecast"),
        ModelRegistry(name="churn_risk", version="1.0.0", trained_at=now, accuracy=85.0, kind="classifier", notes="At-risk account classifier"),
        ModelRegistry(name="anomaly_detector", version="1.0.0", trained_at=now, accuracy=0.0, kind="detector", notes="IsolationForest pipeline outlier detection"),
        ModelRegistry(name="next_best_action", version="1.0.0", trained_at=now, accuracy=0.0, kind="recommender", notes="Rule-based action recommender"),
    ]
    session.add_all(models)
    print(f"  Seeded {len(models)} model registry entries")


def seed_if_empty():
    """Check if DB has data; if not, seed from CSVs."""
    from backend.db import User as UserModel
    with get_session() as session:
        count = session.query(UserModel).count()
        if count > 0:
            print("Database already has data — skipping seed.")
            return False

    print("Database empty — seeding from CSV files...")
    with get_session() as session:
        _import_users(session)
        _import_leads(session)
        _import_deals(session)
        _import_accounts(session)
        _import_activities(session)
        _seed_demo_notifications(session)
        _seed_demo_alerts(session)
        _seed_demo_audit(session)
        _seed_models(session)
    print("Seed complete.")
    return True
