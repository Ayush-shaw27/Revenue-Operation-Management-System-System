"""Grounded AI Copilot.

Answers questions by grounding them in real, live metrics from the database and
delegating the natural-language generation to the configured OmniRoute provider
when credentials are present.  There are no canned answers and no fake data:
the "rule fallback" path is a transparent, metric-summarizing responder that is
clearly labelled as such.
"""
from __future__ import annotations
from typing import Any, Dict

from app.ai.omniroute import OmniRouteClient, OmniRouteError
from app.services.exec_summary import build_summary
from app.services import data_store as ds


def _live_metrics() -> Dict[str, Any]:
    summary = build_summary()
    return {
        "pipeline_value": summary["total_pipeline_value"],
        "open_deals": summary["open_deals"],
        "closed_won_value": summary["closed_won_value"],
        "closed_won_count": summary["closed_won_count"],
        "win_rate": summary["win_rate"],
        "total_leads": summary["total_leads"],
        "high_value_deals": summary["high_value_deals"],
        "at_risk_accounts": summary["at_risk_accounts"],
        "leading_source": summary["leading_source"],
        "revenue_forecast": summary["revenue_forecast_metric"],
    }


def _system_prompt() -> str:
    return (
        "You are the RevOps Pro copilot, a revenue operations intelligence "
        "assistant. Answer concisely and factually using ONLY the live metrics "
        "provided in the user message's context block. Do not invent numbers. "
        "Reference the provided metrics explicitly and suggest one actionable "
        "recommendation when relevant."
    )


class RuleCopilot:
    """Copilot facade: OmniRoute-backed with a transparent local fallback."""

    def __init__(self, client: OmniRouteClient | None = None):
        self.client = client or OmniRouteClient()

    def ask(self, question: str) -> Dict[str, Any]:
        metrics = _live_metrics()
        context_block = (
            "LIVE METRICS (do not invent anything outside these):\n"
            + "\n".join(f"- {k}: {v}" for k, v in metrics.items())
        )
        messages = [
            {"role": "system", "content": _system_prompt()},
            {"role": "user", "content": f"{context_block}\n\nQUESTION: {question}"},
        ]

        if self.client.is_configured:
            try:
                answer = self.client.chat(messages)
                return {
                    "answer": answer,
                    "provider": "omniroute",
                    "model": self.client.model,
                    "context": metrics,
                }
            except OmniRouteError as e:
                return {
                    "answer": self._rule_answer(question, metrics),
                    "provider": "local-rules",
                    "model": None,
                    "note": f"OmniRoute unavailable ({e}); returning transparent rule summary.",
                    "context": metrics,
                }

        return {
            "answer": self._rule_answer(question, metrics),
            "provider": "local-rules",
            "model": None,
            "note": "No OmniRoute credentials configured; returning transparent rule summary.",
            "context": metrics,
        }

    @staticmethod
    def _rule_answer(question: str, metrics: Dict[str, Any]) -> str:
        """Transparent, metric-grounded responder used when OmniRoute is absent.

        This is intentionally factual (not generative) so the user always knows
        the source of the numbers.
        """
        q = question.lower()
        if any(k in q for k in ("forecast", "revenue", "projection")):
            return (
                f"Based on live data, closed-won revenue is "
                f"${metrics['closed_won_value']:,.0f} across "
                f"{metrics['closed_won_count']} deals, and the forecast figure is "
                f"${metrics['revenue_forecast']:,.0f}. Win rate is "
                f"{metrics['win_rate']}%."
            )
        if any(k in q for k in ("pipeline", "health", "deal")):
            return (
                f"Pipeline value is ${metrics['pipeline_value']:,.0f} across "
                f"{metrics['open_deals']} open deals, with {metrics['closed_won_count']} "
                f"closed-won and a win rate of {metrics['win_rate']}%. "
                f"{metrics['high_value_deals']} high-value deals (>= $100K) are open."
            )
        if any(k in q for k in ("lead", "source", "acquisition")):
            return (
                f"There are {metrics['total_leads']} leads in the pipeline; the "
                f"leading source is '{metrics['leading_source']}'."
            )
        if any(k in q for k in ("churn", "risk", "account", "at-risk")):
            return (
                f"{metrics['at_risk_accounts']} accounts are currently at-risk. "
                f"Target them with proactive engagement before renewal."
            )
        # Generic response: still fully metric-grounded.
        return (
            f"Current live snapshot: pipeline ${metrics['pipeline_value']:,.0f}, "
            f"{metrics['open_deals']} open deals, win rate {metrics['win_rate']}%, "
            f"{metrics['total_leads']} leads, and {metrics['at_risk_accounts']} "
            f"at-risk accounts. Ask about pipeline, revenue, leads, or churn for "
            f"more specifics."
        )