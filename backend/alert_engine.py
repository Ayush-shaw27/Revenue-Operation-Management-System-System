"""backend/alert_engine.py
Evaluates a set of rule-based alerts over deals and accounts.

Rules:
  1. stale_deal: days_in_stage exceeds the per-stage threshold.
  2. risk_crossing: account churn risk tier is "high" in the current prediction.
  3. high_value_at_risk: high-value deal stalled in a late stage.
"""
import uuid
from typing import Dict, Any, List, Optional

from backend import data_store as ds

STAGE_DWELL_LIMITS: Dict[str, int] = {
    "prospecting": 10,
    "qualification": 14,
    "proposal": 14,
    "negotiation": 21,
}

HIGH_VALUE_THRESHOLD = 100_000


def evaluate_entity(entity_id: str, entity_type: str = "lead") -> List[Dict[str, Any]]:
    return [{"entity_id": entity_id, "entity_type": entity_type, "alert": "evaluated"}]

def evaluate_account(account_id: str) -> List[Dict[str, Any]]:
    return [{"account_id": account_id, "alert": "account evaluated"}]

def evaluate(churn_predictions: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
    """Run every rule and return a fresh alert list."""
    alerts: List[Dict[str, Any]] = []

    # ── stale deals ───────────────────────────────────────────────────────
    for deal in ds.get_deals():
        stage = deal.get("stage", "")
        dwell_limit = STAGE_DWELL_LIMITS.get(stage, 14)
        if deal.get("days_in_stage", 0) > dwell_limit:
            alerts.append({
                "id": f"al{uuid.uuid4().hex[:8]}",
                "kind": "stale_deal",
                "severity": "high" if deal.get("days_in_stage", 0) > dwell_limit * 1.5 else "medium",
                "entity_type": "deal",
                "entity_id": deal["id"],
                "entity_name": deal.get("title", "Deal"),
                "summary": f"No stage change in {deal['days_in_stage']} days (>{dwell_limit} threshold).",
                "read": False,
                "created_at": ds._now(),
            })

    # ── high-value stalled deals ──────────────────────────────────────────
    for deal in ds.get_deals():
        if (deal.get("value", 0) > HIGH_VALUE_THRESHOLD
                and deal.get("stage", "") in ("qualification", "proposal")
                and deal.get("days_in_stage", 0) > 14):
            alerts.append({
                "id": f"al{uuid.uuid4().hex[:8]}",
                "kind": "high_value_stall",
                "severity": "high",
                "entity_type": "deal",
                "entity_id": deal["id"],
                "entity_name": deal.get("title", "Deal"),
                "summary": f"${deal['value']:,.0f} deal stalled at {deal['stage']}.",
                "read": False,
                "created_at": ds._now(),
            })

    # ── churn risk crossings ──────────────────────────────────────────────
    if churn_predictions is not None:
        for pred in churn_predictions:
            if pred.get("tier") == "high":
                alerts.append({
                    "id": f"al{uuid.uuid4().hex[:8]}",
                    "kind": "risk_crossing",
                    "severity": "high",
                    "entity_type": "account",
                    "entity_id": pred.get("account_id", ""),
                    "entity_name": pred.get("account_name", "Account"),
                    "summary": f"Account entered HIGH churn risk (score {pred['risk_score']:.2f}).",
                    "read": False,
                    "created_at": ds._now(),
                })

    ds.replace_alerts(alerts)
    return alerts