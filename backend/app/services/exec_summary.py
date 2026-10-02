"""Executive summary — real metrics computed from the live database."""
from __future__ import annotations
import datetime
from typing import Any, Dict

from app.services import data_store as ds


def build_summary() -> Dict[str, Any]:
    """Build an executive summary from live pipeline data."""
    deals = ds.get_deals()
    leads = ds.get_leads()
    accounts = ds.get_accounts()

    total_pipeline_value = round(sum(d.get("value", 0) for d in deals), 2)
    open_deals = [d for d in deals if d.get("stage") not in ("closed-won", "closed-lost")]
    closed_won = [d for d in deals if d.get("stage") == "closed-won"]
    closed_lost = [d for d in deals if d.get("stage") == "closed-lost"]

    won_value = round(sum(d.get("value", 0) for d in closed_won), 2)
    decided = len(closed_won) + len(closed_lost)
    win_rate = round(len(closed_won) / decided * 100, 1) if decided else 0.0
    avg_deal_value = round(won_value / len(closed_won), 2) if closed_won else 0.0

    high_value_deals = sum(1 for d in deals if d.get("value", 0) >= 100_000)
    at_risk_accounts = sum(1 for a in accounts if a.get("health_score", 0.5) < 0.4)

    source_scores: Dict[str, int] = {}
    for l in leads:
        source_scores[l.get("source", "Unknown")] = source_scores.get(l.get("source", "Unknown"), 0) + 1
    leading_source = max(source_scores, key=source_scores.get) if source_scores else "None"

    return {
        "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        "total_pipeline_value": total_pipeline_value,
        "open_deals": len(open_deals),
        "closed_won_value": won_value,
        "closed_won_count": len(closed_won),
        "win_rate": win_rate,
        "avg_deal_value": avg_deal_value,
        "total_leads": len(leads),
        "high_value_deals": high_value_deals,
        "at_risk_accounts": at_risk_accounts,
        "leading_source": leading_source,
        "revenue_forecast_metric": round(won_value * (1 + win_rate / 100), 2),
    }