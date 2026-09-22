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

        won = sum(1 for d in deals if d.get("stage") == "closed-won")
        lost = sum(1 for d in deals if d.get("stage") == "closed-lost")
        decided = won + lost
        win_rate = round(won / decided * 100, 1) if decided else round(
            sum(d.get("probability", 50) for d in deals) / deal_count, 1
        )

        avg_prob = sum(d.get("probability", 50) for d in deals) / deal_count
        stalled = sum(1 for d in deals if d.get("days_in_stage", 0) > 14)
        stalled_penalty = min(stalled * 8, 30)
        health = int(max(30, min(100, round(avg_prob * 0.6 + (100 - stalled_penalty) * 0.4))))

        stage_counts: Dict[str, List[Dict]] = {}
        for d in deals:
            stage_counts.setdefault(d.get("stage", "unknown"), []).append(d)
        bottleneck_stage = max(stage_counts, key=lambda s: len(stage_counts[s])) if stage_counts else "none"
        bottleneck_count = len(stage_counts.get(bottleneck_stage, []))
        if bottleneck_count > 1:
            insights.append({
                "id": str(uuid.uuid4())[:8],
                "type": "warning",
                "title": f"{bottleneck_stage.title()} Stage Bottleneck",
                "description": f"{bottleneck_count} deal(s) concentrated in '{bottleneck_stage}'. Review stage velocity.",
                "confidence": round(88.0 - stalled_penalty, 1),
                "actionable": True,
                "metric_affected": "Win Rate & Slippage",
                "evidence": f"Based on {deal_count} deals in pipeline",
                "recommendation": f"Review {bottleneck_stage} stage deals for accelerators",
            })

        stalled_deals = [d for d in deals if d.get("days_in_stage", 0) > 14]
        if stalled_deals:
            insights.append({
                "id": str(uuid.uuid4())[:8],
                "type": "warning",
                "title": "Stalled Deals Require Attention",
                "description": f"{len(stalled_deals)} deal(s) have not progressed in >14 days.",
                "confidence": 90.0,
                "actionable": True,
                "metric_affected": "Deal Velocity",
                "evidence": f"Based on {len(stalled_deals)} stalled deals",
                "recommendation": "Escalate or refresh engagement",
            })

        high_value = sum(1 for d in deals if d.get("value", 0) >= 100000)
        if high_value:
            insights.append({
                "id": str(uuid.uuid4())[:8],
                "type": "neutral",
                "title": "High-Value Deal Exposure",
                "description": f"{high_value} deal(s) exceed $100K.",
                "confidence": 84.0,
                "actionable": False,
                "metric_affected": "Average Contract Value",
                "evidence": f"${total_value:,.0f} total pipeline value",
                "recommendation": "Focus executive engagement on large deals",
            })

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
                "description": f"Leads from '{best_source}' average AI score {avg_best}.",
                "confidence": 82.0,
                "actionable": True,
                "metric_affected": "Customer Acquisition Cost",
                "evidence": f"Based on {len(leads)} leads across {len(source_scores)} sources",
                "recommendation": f"Shift marketing spend toward {best_source}",
            })

        if deal_count > 0:
            insights.append({
                "id": str(uuid.uuid4())[:8],
                "type": "positive",
                "title": "Pipeline Value Overview",
                "description": f"Pipeline holds ${total_value:,.0f} across {deal_count} deals (avg probability {avg_prob:.0f}%).",
                "confidence": 91.0,
                "actionable": False,
                "metric_affected": "Pipeline Coverage",
                "evidence": f"${total_value:,.0f} pipeline, {deal_count} deals",
                "recommendation": "Monitor high-value deals for acceleration",
            })

        if not insights:
            insights.append({
                "id": str(uuid.uuid4())[:8],
                "type": "neutral",
                "title": "No Pipeline Data Yet",
                "description": "Add deals and leads to unlock diagnostic insights.",
                "confidence": 70.0,
                "actionable": False,
                "metric_affected": "Pipeline Coverage",
                "evidence": "No deals or leads found",
                "recommendation": "Import or create leads to populate pipeline",
            })

        return {
            "pipeline_health_score": float(health),
            "win_rate_estimate": float(win_rate),
            "total_pipeline_value": float(total_value),
            "total_deals": deal_count,
            "insights": insights,
        }