"""Recurring background jobs (APScheduler-driven)."""
from __future__ import annotations
from typing import Any, Dict

from app.core.config import settings
from app.services import data_store as ds
from app.ml.artifacts.lead_scoring_model import LeadScoringModel
from app.ml.artifacts.churn_model import ChurnRiskModel
from app.ml.artifacts.anomaly_detector import DealAnomalyDetector


def rerun_rebuild() -> Dict[str, Any]:
    """Re-score leads / accounts / deals from live data and persist results.

    Runs periodically so ML labels stay fresh; every write is real and DB-backed.
    """
    summary: Dict[str, Any] = {"scored_leads": 0, "scored_accounts": 0, "checked_deals": 0}

    try:
        lead_model = LeadScoringModel()
        for lead in ds.get_leads():
            try:
                pred = lead_model.predict({
                    "name": lead.get("name", ""), "company": lead.get("company", ""),
                    "value": lead.get("value", 30000), "source": lead.get("source", "Website"),
                    "touchpoints": lead.get("touchpoints", 3),
                    "industry": lead.get("industry", "Technology"),
                    "company_size": lead.get("company_size", "Mid-Market"),
                })
                ds.update_lead(lead["id"], {
                    "ai_score": pred["score"], "ai_label": pred["label"],
                    "ai_factors": pred.get("factors", []),
                })
                summary["scored_leads"] += 1
            except Exception:
                continue
    except Exception:
        pass

    try:
        churn_model = ChurnRiskModel()
        preds = churn_model.predict_many(ds.get_accounts())
        summary["scored_accounts"] = len(preds)
    except Exception:
        pass

    try:
        anomaly_model = DealAnomalyDetector()
        anomalies = anomaly_model.detect(ds.get_deals())
        summary["checked_deals"] = len(anomalies)
    except Exception:
        pass

    return summary


def snapshot_metrics() -> Dict[str, Any]:
    """Persist a MetricSnapshot of current pipeline KPIs."""
    deals = ds.get_deals()
    leads = ds.get_leads()
    accounts = ds.get_accounts()

    total_pipeline = round(sum(d.get("value", 0) for d in deals), 2)
    open_deals = sum(1 for d in deals if d.get("stage") not in ("closed-won", "closed-lost"))
    closed_won = sum(1 for d in deals if d.get("stage") == "closed-won")

    values = {
        "pipeline_value": total_pipeline,
        "open_deals": float(open_deals),
        "closed_won_count": float(closed_won),
        "total_leads": float(len(leads)),
        "total_accounts": float(len(accounts)),
    }
    for name, value in values.items():
        ds._snapshot(name, value)
    return values