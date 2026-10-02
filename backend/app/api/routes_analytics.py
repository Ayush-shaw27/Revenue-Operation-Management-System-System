"""Analytics routes: funnel, cohorts, trends, revenue history, exec summary, scenario."""
from __future__ import annotations
from typing import Any, Dict, List

import numpy as np
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import AuthUser, get_current_user
from app.ml.inference.revenue_forecast_model import RevenueForecastModel
from app.schemas import (
    AnalyticsFunnelResponse, AnalyticsCohortsResponse,
    ExecSummary, ForecastScenarioRequest,
)
from app.services import data_store as ds
from app.services.exec_summary import build_summary

router = APIRouter(tags=["analytics"], prefix="/api/analytics")


def _monthly_revenue(deals: List[Dict[str, Any]]) -> Dict[str, float]:
    monthly: Dict[str, float] = {}
    for d in deals:
        if d.get("stage") == "closed-won":
            key = (d.get("close_date") or d.get("created_at") or "")[:7]
            if key:
                monthly[key] = monthly.get(key, 0.0) + float(d.get("value", 0))
    return monthly


@router.get("/funnel", response_model=AnalyticsFunnelResponse)
async def analytics_funnel(by: str = "source", current_user: AuthUser = Depends(get_current_user)):
    leads = ds.get_leads()
    if by == "stage":
        counts: Dict[str, int] = {}
        for l in leads:
            counts[l.get("status", "unknown")] = counts.get(l.get("status", "unknown"), 0) + 1
        mapping = [
            ("new", "New", "#3b82f6"),
            ("contacted", "Contacted", "#8b5cf6"),
            ("qualified", "Qualified", "#06b6d4"),
            ("converted", "Converted", "#10b981"),
        ]
    else:
        counts = {}
        for l in leads:
            src = l.get("source", "Unknown")
            counts[src] = counts.get(src, 0) + 1
        mapping = [(k, k, None) for k in counts.keys()]
    funnel = []
    for key, label, color in mapping:
        if key in counts:
            funnel.append({"name": label, "value": counts[key], "color": color})
    return {"by": by, "funnel": funnel}


@router.get("/cohorts", response_model=AnalyticsCohortsResponse)
async def analytics_cohorts(current_user: AuthUser = Depends(get_current_user)):
    leads = ds.get_leads()
    cohort_counts: Dict[str, Dict[str, int]] = {}
    for l in leads:
        month = l.get("created_at", "2024-01")[:7]
        entry = cohort_counts.setdefault(month, {"total": 0, "converted": 0})
        entry["total"] += 1
        if l.get("status") == "converted":
            entry["converted"] += 1
    cohorts = []
    for month, counts in sorted(cohort_counts.items()):
        rate = round((counts["converted"] / counts["total"] * 100), 1) if counts["total"] else 0.0
        cohorts.append({"cohort": month, "total": counts["total"],
                        "converted": counts["converted"], "conversion_rate": rate})
    return {"cohorts": cohorts}


@router.get("/trends")
async def analytics_trends(current_user: AuthUser = Depends(get_current_user)):
    deals = ds.get_deals()
    monthly = _monthly_revenue(deals)
    points = [
        {"period": month, "revenue": round(value, 2)}
        for month, value in sorted(monthly.items())
    ]
    return {"metric": "closed_won_revenue", "points": points}


@router.get("/revenue-history")
async def revenue_history(current_user: AuthUser = Depends(get_current_user)):
    deals = ds.get_deals()
    monthly = _monthly_revenue(deals)
    points = [
        {"period": month, "actual": round(value, 2), "count": sum(
            1 for d in deals if d.get("stage") == "closed-won"
            and (d.get("close_date") or "")[:7] == month)}
        for month, value in sorted(monthly.items())
    ]
    return {"points": points}


@router.get("/exec-summary", response_model=ExecSummary)
async def exec_summary(current_user: AuthUser = Depends(get_current_user)):
    return build_summary()


@router.post("/forecast-scenario")
async def forecast_scenario(request: ForecastScenarioRequest,
                            current_user: AuthUser = Depends(get_current_user)):
    """Scenario simulator: reapplies the trained forecast under a modified model."""
    model = RevenueForecastModel()
    base = model.forecast(timeframe=request.timeframe, model_type=request.model_type)
    factor = request.factor + (request.headcount - 1) * 0.02 - request.discount * 0.01
    factor = max(0.0, factor)
    for point in base["data"]:
        point["mlForecast"] = round(point["mlForecast"] * factor, 2)
        point["traditional"] = round(point["traditional"] * factor, 2)
    base["ml_projected_total"] = round(sum(p["mlForecast"] for p in base["data"]), 2)
    base["traditional_total"] = round(sum(p["traditional"] for p in base["data"]), 2)
    base["variance_percentage"] = round((factor - 1.0) * 100, 1)
    base["scenario"] = {
        "discount": request.discount, "headcount": request.headcount, "factor": request.factor,
    }
    return base