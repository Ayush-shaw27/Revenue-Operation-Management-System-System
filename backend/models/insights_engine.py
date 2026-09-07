"""backend/models/insights_engine.py
Pipeline insights computed from live pipeline data in backend.data_store.

Evaluates operational signals (bottlenecks, velocity, win-rate, lead-source
effectiveness) and produces structured diagnostic intelligence derived from
real deal/lead metrics rather than hardcoded output.
"""
import uuid
from typing import Dict, Any, List

from backend import data_store as ds


class PipelineInsightsEngine:
    def __init__(self):
        pass

    def generate_insights(self) -> Dict[str, Any]:
        deals = ds.get_deals()
        leads = ds.get_leads()

        insights: List[Dict[str, Any]] = []
        total_value = sum(d.get("value", 0) for d in deals)
        deal_count = max(len(deals), 1)

        # ── Win-rate estimate ─────────────────────────────────────────────
        won = sum(1 for d in deals if d.get("stage") == "closed-won")
        lost = sum(1 for d in deals if d.get("stage") == "closed-lost")
        decided = won + lost
        win_rate = round(won / decided * 100, 1) if decided else round(
            sum(d.get("probability", 50) for d in deals) / deal_count, 1
        )

        # ── Pipeline health score ─────────────────────────────────────────
        avg_prob = sum(d.get("probability", 50) for d in deals) / deal_count
        stalled = sum(1 for d in deals if d.get("days_in_stage", 0) > 14)
        stalled_penalty = min(stalled * 8, 30)
        health = int(max(30, min(100, round(avg_prob * 0.6 + (100 - stalled_penalty) * 0.4))))

        # ── Stage bottleneck detection ────────────────────────────────────
        stage_counts: Dict[str, List[Dict]] = {}
        for d in deals:
            stage_counts.setdefault(d.get("stage", "unknown"), []).append(d)
        bottleneck_stage = max(stage_counts, key=lambda s: len(stage_counts[s])) if stage_counts else "none"
        bottleneck_count = len(stage_counts.get(bottleneck_stage, []))
        if bottleneck_count > 1:
            insights.append({
                "id": str(uuid.uuid4())[:8],
                "type": "warning",
                "title": f"{bottleneck_stage.title()} Stage Bottleneck Detected",
                "description": (f"{bottleneck_count} deal(s) are concentrated in '{bottleneck_stage}'. "
                                f"Review stage velocity to prevent slippage."),
                "confidence": 88,
                "actionable": True,
                "metric_affected": "Win Rate & Slippage Probability",
            })

        # ── Stalled / at-risk deals ───────────────────────────────────────
        stalled_deals = [d for d in deals if d.get("days_in_stage", 0) > 14]
        if stalled_deals:
            insights.append({
                "id": str(uuid.uuid4())[:8],
                "type": "warning",
                "title": "Stalled Deals Require Attention",
                "description": (f"{len(stalled_deals)} deal(s) have not progressed in >14 days. "
                                "Escalate or refresh engagement to keep the pipeline moving."),
                "confidence": 90,
                "actionable": True,
                "metric_affected": "Deal Velocity",
            })

        # ── High-value exposure ───────────────────────────────────────────
        high_value = sum(1 for d in deals if d.get("value", 0) >= 100000)
        if high_value:
            insights.append({
                "id": str(uuid.uuid4())[:8],
                "type": "neutral",
                "title": "High-Value Deal Exposure",
                "description": (f"{high_value} deal(s) exceed $100K. Focus executive engagement "
                                "on these opportunities to protect pipeline value."),
                "confidence": 84,
                "actionable": False,
                "metric_affected": "Average Contract Value",
            })

        # ── Lead source effectiveness ─────────────────────────────────────
        source_scores: Dict[str, List[int]] = {}
        for l in leads:
            s = l.get("source", "Unknown")
            source_scores.setdefault(s, []).append(l.get("ai_score", 0) or 0)
        best_source = max(source_scores, key=lambda s: sum(source_scores[s]) / len(source_scores[s])) if source_scores else None
        if best_source:
            avg_best = round(sum(source_scores[best_source]) / len(source_scores[best_source]), 1)
            insights.append({
                "id": str(uuid.uuid4())[:8],
                "type": "positive",
                "title": f"Best Lead Source: {best_source}",
                "description": (f"Leads from '{best_source}' average an AI score of {avg_best}. "
                                "Shift more marketing spend to this channel."),
                "confidence": 82,
                "actionable": True,
                "metric_affected": "Customer Acquisition Cost (CAC)",
            })

        # ── Positive pipeline health ──────────────────────────────────────
        if deal_count > 0:
            insights.append({
                "id": str(uuid.uuid4())[:8],
                "type": "positive",
                "title": "Pipeline Value Overview",
                "description": (f"Pipeline currently holds ${total_value:,.0f} across {deal_count} "
                                f"deals with an average probability of {avg_prob:.0f}%."),
                "confidence": 91,
                "actionable": False,
                "metric_affected": "Pipeline Coverage",
            })

        if not insights:
            insights.append({
                "id": str(uuid.uuid4())[:8],
                "type": "neutral",
                "title": "No Pipeline Data Yet",
                "description": "Add deals and leads to unlock diagnostic insights.",
                "confidence": 70,
                "actionable": False,
                "metric_affected": "Pipeline Coverage",
            })

        return {
            "pipeline_health_score": health,
            "win_rate_estimate": win_rate,
            "insights": insights,
        }
