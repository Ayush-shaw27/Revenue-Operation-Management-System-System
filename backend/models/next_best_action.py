"""backend/models/next_best_action.py
Next-best-action recommender (P1).

Ranked candidate actions per deal — call, discount, escalate, send case study,
schedule review — scored by deal context features with a human-readable
rationale string per suggestion.
"""
from typing import Dict, Any, List


ACTION_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "call": {
        "action": "Schedule a discovery call",
        "channel": "phone",
        "icon": "phone",
    },
    "discount": {
        "action": "Propose a limited-time discount",
        "channel": "email",
        "icon": "percent",
    },
    "escalate": {
        "action": "Escalate to executive sponsor",
        "channel": "internal",
        "icon": "arrow-up",
    },
    "send_case_study": {
        "action": "Send a relevant case study",
        "channel": "email",
        "icon": "book-open",
    },
    "schedule_review": {
        "action": "Schedule a pipeline review",
        "channel": "internal",
        "icon": "calendar",
    },
}

STAGE_WEIGHTS: Dict[str, Dict[str, float]] = {
    "prospecting": {"call": 0.9, "send_case_study": 0.7, "discount": 0.1, "escalate": 0.05, "schedule_review": 0.3},
    "qualification": {"call": 0.8, "send_case_study": 0.85, "discount": 0.15, "escalate": 0.1, "schedule_review": 0.5},
    "proposal": {"call": 0.6, "send_case_study": 0.4, "discount": 0.65, "escalate": 0.2, "schedule_review": 0.55},
    "negotiation": {"call": 0.75, "discount": 0.85, "escalate": 0.6, "send_case_study": 0.2, "schedule_review": 0.4},
}


def _rationale(action: str, deal: Dict[str, Any]) -> str:
    stage = deal.get("stage", "prospecting")
    value = deal.get("value", 0)
    prob = deal.get("probability", 50)
    days = deal.get("days_in_stage", 0)
    reasons: List[str] = []

    if action == "call":
        reasons.append(f"Deal is in {stage} with {prob}% probability")
        if prob < 40:
            reasons.append("Low probability — more qualification needed")
        else:
            reasons.append("Good progress — use call to advance")
    elif action == "discount":
        reasons.append(f"Deals >${value:,.0f} respond well to value incentives")
        if days > 10:
            reasons.append(f"Stalled for {days} days — discount may break deadlock")
        else:
            reasons.append("Strategic discount could accelerate close")
    elif action == "escalate":
        reasons.append(f"${value:,.0f} deal justifies executive engagement")
        if prob > 70:
            reasons.append("High probability close warrants champion alignment")
        else:
            reasons.append("Strategic intervention could improve win rate")
    elif action == "send_case_study":
        reasons.append("Social proof builds buyer confidence")
        if prob < 50:
            reasons.append("Early stage — case study helps validate approach")
        else:
            reasons.append("Strong position — case study seals deal")
    elif action == "schedule_review":
        reasons.append(f"Pipeline review ensures deal is on track")
        if days > 10:
            reasons.append(f"{days} days in stage — needs management visibility")
        else:
            reasons.append("Regular cadence maintains momentum")

    return " | ".join(reasons)


def recommend(deal: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return ranked recommended actions for a single deal."""
    stage = deal.get("stage", "prospecting")
    base = STAGE_WEIGHTS.get(stage, STAGE_WEIGHTS["prospecting"])
    scores: List[Dict[str, Any]] = []

    for action_id, template in ACTION_TEMPLATES.items():
        raw_score = base.get(action_id, 0.1)
        # Context modifiers
        value = deal.get("value", 0)
        prob = deal.get("probability", 50)
        days = deal.get("days_in_stage", 0)

        # High-value deals: escalate and discount slightly more important
        if value > 100000:
            if action_id == "escalate":
                raw_score += 0.12
            elif action_id == "discount":
                raw_score += 0.08

        # Stalled deals: escalation + discount get a boost
        if days > 14:
            if action_id == "escalate":
                raw_score += 0.15
            elif action_id == "discount":
                raw_score += 0.1

        # Early-stage: calls + case studies are more valuable
        if prob < 40 and action_id in ("call", "send_case_study"):
            raw_score += 0.08

        final = min(raw_score, 1.0)
        scores.append({
            "action_id": action_id,
            "action": template["action"],
            "channel": template["channel"],
            "priority": round(final, 2),
            "rationale": _rationale(action_id, deal),
        })

    scores.sort(key=lambda x: -x["priority"])
    for i, s in enumerate(scores):
        s["rank"] = i + 1
    return scores


def recommend_for_deals(deals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Return recommendations for every deal."""
    return [
        {
            "deal_id": d["id"],
            "deal_title": d.get("title", ""),
            "company": d.get("company", ""),
            "stage": d.get("stage", ""),
            "recommendations": recommend(d),
        }
        for d in deals
    ]