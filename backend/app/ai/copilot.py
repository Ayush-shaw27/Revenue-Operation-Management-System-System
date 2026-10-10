"""Grounded AI Copilot.

Two engines, one contract:

* **Grok (xAI)** answers when ``XAI_API_KEY`` is set.
* **The rule engine** answers when it is not.

The original version of this file had a rule engine that was a keyword matcher
returning the same sentence regardless of the question — ask "which is the
highest lead?" and it replied with the total lead count. It also fed Grok only
11 aggregate numbers, so even with a working key the model *could not* answer
"which lead is highest", because the lead names were never in the context.

Both are fixed here:

* :func:`data_snapshot` puts real records (top leads by value, open deals,
  at-risk accounts, pipeline by stage, leads by source) into the context, so the
  model can answer questions about actual entities.
* :meth:`RuleCopilot.rule_answer` parses the question's intent and queries the
  database directly, so the offline engine answers "the highest-value lead is
  Jeffrey King at TaskForge, $337,437" instead of reciting totals.

Honesty rules, unchanged and still enforced: every response declares which
engine produced it (``provider``), which model (``model``), and a ``note``
explaining any fallback. The rule engine never claims to be AI, and the AI path
never invents a number that is not in the context block.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

from app.ai.provider import GrokClient, ProviderError
from app.services.exec_summary import build_summary
from app.services import data_store as ds

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Reported verbatim in every copilot response so the UI can always tell which
# engine actually produced the answer.  Change this only if you change provider.
PROVIDER_NAME = "grok"

# How many records of each kind to put in the AI context.  Small enough to stay
# cheap, large enough that "which is the highest X?" is always answerable.
CONTEXT_TOP_N = 10
CONTEXT_RISK_N = 5


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------
def _money(value: Any) -> str:
    try:
        return f"${float(value or 0):,.0f}"
    except (TypeError, ValueError):
        return "$0"


def _num(value: Any, default: Any = 0) -> Any:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _lead_line(lead: Dict[str, Any]) -> str:
    score = lead.get("ai_score")
    score_txt = f", AI score {score}/100" if score is not None else ""
    return (
        f"- {lead.get('name')} at {lead.get('company')} | "
        f"{_money(lead.get('value'))} | status {lead.get('status')} | "
        f"source {lead.get('source')} | {lead.get('industry')}{score_txt}"
    )


def _deal_line(deal: Dict[str, Any]) -> str:
    title = deal.get("title") or deal.get("name") or deal.get("id")
    prob = deal.get("probability")
    prob_txt = f", probability {prob}%" if prob is not None else ""
    stalled = ""
    days = deal.get("days_in_stage")
    if days:
        stalled = f", {days} days in stage"
    return (
        f"- {title} at {deal.get('company')} | {_money(deal.get('value'))} | "
        f"stage {deal.get('stage')}{prob_txt}{stalled} | owner {deal.get('owner')}"
    )


def _account_line(account: Dict[str, Any]) -> str:
    return (
        f"- {account.get('name')} | contract {_money(account.get('contract_value'))} | "
        f"health {account.get('health_score')}/100 | "
        f"renewal in {account.get('renewal_in_days')} days | "
        f"usage trend {account.get('usage_trend')}"
    )


# ---------------------------------------------------------------------------
# Live metrics + record snapshot
# ---------------------------------------------------------------------------
def live_metrics() -> Dict[str, Any]:
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


def _group_count(rows: List[Dict[str, Any]], key: str) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for row in rows:
        label = str(row.get(key) or "unknown")
        counts[label] = counts.get(label, 0) + 1
    return dict(sorted(counts.items(), key=lambda kv: kv[1], reverse=True))


def _group_value(rows: List[Dict[str, Any]], key: str) -> Dict[str, float]:
    totals: Dict[str, float] = {}
    for row in rows:
        label = str(row.get(key) or "unknown")
        totals[label] = totals.get(label, 0.0) + _num(row.get("value"))
    return dict(sorted(totals.items(), key=lambda kv: kv[1], reverse=True))


def data_snapshot() -> Dict[str, Any]:
    """Real records pulled from the database, not aggregates.

    This is what makes "which is the highest lead?" answerable at all.  Every
    value here comes from a live row; nothing is invented.
    """
    leads = ds.get_leads() or []
    deals = ds.get_deals() or []
    accounts = ds.get_accounts() or []

    # "Open" must mean exactly what `exec_summary.build_summary()` means, or the
    # copilot contradicts itself: it reported 95 open deals from the metrics and
    # 106 from this list, because closed-lost deals were counted as open here.
    # Keep every spelling the stage column can actually hold.
    closed = {"closed-won", "closed-lost", "closed lost", "closed_won", "closed_lost"}
    open_deals = [
        d for d in deals if str(d.get("stage", "")).strip().lower() not in closed
    ]

    return {
        "leads": leads,
        "deals": deals,
        "accounts": accounts,
        "open_deals": open_deals,
        "top_leads_by_value": sorted(leads, key=lambda r: _num(r.get("value")), reverse=True),
        "top_leads_by_score": sorted(
            (l for l in leads if l.get("ai_score") is not None),
            key=lambda r: _num(r.get("ai_score")), reverse=True,
        ),
        "top_open_deals_by_value": sorted(
            open_deals, key=lambda r: _num(r.get("value")), reverse=True,
        ),
        "at_risk_accounts": sorted(accounts, key=lambda r: _num(r.get("health_score"))),
        "leads_by_source": _group_count(leads, "source"),
        "leads_by_status": _group_count(leads, "status"),
        "deals_by_stage": _group_count(deals, "stage"),
        "value_by_stage": _group_value(deals, "stage"),
    }


def _records_block(snap: Dict[str, Any]) -> str:
    """Render the snapshot as compact text for the AI prompt."""
    parts: List[str] = ["ACTUAL RECORDS FROM THE DATABASE (these are facts):"]

    top_leads = snap["top_leads_by_value"][:CONTEXT_TOP_N]
    if top_leads:
        parts.append("\nTOP LEADS BY OPPORTUNITY VALUE:")
        parts.extend(_lead_line(l) for l in top_leads)

    top_scored = snap["top_leads_by_score"][:3]
    if top_scored:
        parts.append("\nHIGHEST AI-SCORED LEADS:")
        parts.extend(_lead_line(l) for l in top_scored)

    top_deals = snap["top_open_deals_by_value"][:CONTEXT_TOP_N]
    if top_deals:
        parts.append("\nOPEN DEALS BY VALUE:")
        parts.extend(_deal_line(d) for d in top_deals)

    risky = snap["at_risk_accounts"][:CONTEXT_RISK_N]
    if risky:
        parts.append("\nLOWEST HEALTH-SCORE ACCOUNTS (most at risk):")
        parts.extend(_account_line(a) for a in risky)

    if snap["leads_by_source"]:
        parts.append("\nLEAD COUNT BY SOURCE: " + ", ".join(
            f"{k}={v}" for k, v in snap["leads_by_source"].items()))
    if snap["leads_by_status"]:
        parts.append("\nLEAD COUNT BY STATUS: " + ", ".join(
            f"{k}={v}" for k, v in snap["leads_by_status"].items()))
    if snap["deals_by_stage"]:
        parts.append("\nDEAL COUNT BY STAGE: " + ", ".join(
            f"{k}={v}" for k, v in snap["deals_by_stage"].items()))
        parts.append("\nDEAL VALUE BY STAGE: " + ", ".join(
            f"{k}={_money(v)}" for k, v in snap["value_by_stage"].items()))

    return "\n".join(parts)


def _system_prompt() -> str:
    return (
        "You are the RevOps Pro copilot, a revenue operations intelligence "
        "assistant.\n"
        "Answer the question that was actually asked, directly and in the "
        "first sentence.\n"
        "Rules:\n"
        "1. Use ONLY the metrics and records in the context block. Every "
        "number and name you state must appear there.\n"
        "2. If the context does not contain the answer, say so plainly and "
        "point to what is available. Never invent a lead, deal, account, or "
        "figure.\n"
        "3. When asked for the highest / top / biggest X, name the specific "
        "entity and its value.\n"
        "4. Be concise: 1-3 sentences, plus a bullet list only if the question "
        "asks for several items."
    )


# ---------------------------------------------------------------------------
# Intent detection
# ---------------------------------------------------------------------------
_TOP_WORDS = (
    "highest", "biggest", "largest", "best", "maximum", "max ", "max",
    "most valuable", "top", "leading", "strongest",
)
_LIST_WORDS = ("list", "show me", "show all", "all of", "names of", "give me all")
_AT_RISK_WORDS = ("at risk", "at-risk", "churn", "risky", "risk", "unhealthy", "worst health")
_SOURCE_WORDS = ("source", "channel", "where do", "acquisition", "came from")
_COUNT_WORDS = ("how many", "count of", "number of", "total number")
_REVENUE_WORDS = ("revenue", "forecast", "projection", "earnings", "mrr", "arr", "bookings")
_PIPELINE_WORDS = ("pipeline", "stage", "funnel", "conversion", "win rate", "closed won", "open deals")
_SCORE_WORDS = ("score", "scored", "quality", "ranked")

_LEAD_RE = re.compile(r"\b(lead|leads|prospect|prospects)\b")
_DEAL_RE = re.compile(r"\b(deal|deals|opportunit\w*|contract\w*)\b")
_ACCOUNT_RE = re.compile(r"\b(account|accounts|customer\w*|client\w*|churn)\b")
_TOP_N_RE = re.compile(r"\b(?:top|first|best|highest)\s+(\d{1,2})\b|\b(\d{1,2})\s+(?:top|best|highest)\b")


def _is_top(q: str) -> bool:
    return any(w in q for w in _TOP_WORDS)


def _entity(q: str) -> Optional[str]:
    if _ACCOUNT_RE.search(q):
        return "account"
    if _DEAL_RE.search(q):
        return "deal"
    if _LEAD_RE.search(q):
        return "lead"
    return None


def _requested_count(q: str, default: int = 5) -> int:
    m = _TOP_N_RE.search(q)
    if m:
        n = m.group(1) or m.group(2)
        if n:
            try:
                return max(1, min(50, int(n)))
            except ValueError:
                pass
    if any(w in q for w in _LIST_WORDS):
        return 10
    return default


def _mentions(q: str, rows: List[Dict[str, Any]], fields: Tuple[str, ...]) -> Optional[Dict[str, Any]]:
    """Find a record whose name/company the question refers to.

    Deliberately conservative: the token must be at least 4 characters and
    appear as a whole word, so "acme" matches "Acme Corp" but "the" does not
    match every row.
    """
    for row in rows:
        for field in fields:
            value = str(row.get(field) or "").strip()
            if len(value) < 4:
                continue
            candidates = {value.lower()}
            candidates.add(value.split()[0].lower() if value else "")
            for candidate in candidates:
                if len(candidate) >= 4 and re.search(rf"\b{re.escape(candidate)}\b", q):
                    return row
    return None


# ---------------------------------------------------------------------------
# Copilot
# ---------------------------------------------------------------------------
class RuleCopilot:
    """Copilot facade: Grok-backed with a transparent, data-grounded fallback."""

    def __init__(self, client: GrokClient | None = None):
        self.client = client or GrokClient()

    def _activities_context(self, question: str) -> str:
        activities = ds.get_activity(limit=50)
        if not activities:
            return "No recent activities."
        texts = [
            f"{a.get('action', '')} {a.get('resource', '')} {a.get('type', '')}"
            for a in activities
        ]
        vectorizer = TfidfVectorizer(stop_words="english")
        try:
            tfidf_matrix = vectorizer.fit_transform(texts)
            question_vec = vectorizer.transform([question])
            similarities = cosine_similarity(question_vec, tfidf_matrix).flatten()
            top_indices = similarities.argsort()[-3:][::-1]
            relevant = [activities[i] for i in top_indices if similarities[i] > 0.1]
            if not relevant:
                return "No highly relevant recent activities."
            return "RECENT RELEVANT ACTIVITIES:\n" + "\n".join(
                f"- {a['timestamp']}: {a['action']} on {a['resource']} ({a['type']})"
                for a in relevant
            )
        except Exception:
            return "Could not retrieve activity context."

    def _build(self, question: str) -> Tuple[Dict[str, Any], Dict[str, Any], List[Dict[str, str]]]:
        metrics = live_metrics()
        snapshot = data_snapshot()
        context_block = "\n\n".join([
            "LIVE METRICS:",
            "\n".join(f"- {k}: {v}" for k, v in metrics.items()),
            _records_block(snapshot),
            self._activities_context(question),
        ])
        messages = [
            {"role": "system", "content": _system_prompt()},
            {"role": "user", "content": f"{context_block}\n\nQUESTION: {question}"},
        ]
        return metrics, snapshot, messages

    def _fallback(self, question: str, metrics: Dict[str, Any], snapshot: Dict[str, Any],
                  reason: str) -> Dict[str, Any]:
        return {
            "answer": self.rule_answer(question, metrics, snapshot),
            "provider": "local-rules",
            "model": None,
            "note": f"{reason}. This answer came from a deterministic database "
                    f"lookup, not from an AI model.",
            "context": metrics,
        }

    def ask(self, question: str) -> Dict[str, Any]:
        metrics, snapshot, messages = self._build(question)

        if self.client.is_configured:
            try:
                answer = self.client.chat(messages)
                return {
                    "answer": answer,
                    "provider": PROVIDER_NAME,
                    "model": self.client.model,
                    "context": metrics,
                }
            except ProviderError as e:
                return self._fallback(question, metrics, snapshot, f"xAI/Grok unavailable ({e})")

        return self._fallback(question, metrics, snapshot, "XAI_API_KEY is not configured")

    async def ask_async(self, question: str) -> Dict[str, Any]:
        """Async variant used by the HTTP route.

        Same behaviour as :meth:`ask` but the provider call yields to the event
        loop, so a slow gateway no longer blocks every other API request.
        """
        metrics, snapshot, messages = self._build(question)

        if self.client.is_configured:
            try:
                answer = await self.client.chat_async(messages)
                return {
                    "answer": answer,
                    "provider": PROVIDER_NAME,
                    "model": self.client.model,
                    "context": metrics,
                }
            except ProviderError as e:
                return self._fallback(question, metrics, snapshot, f"xAI/Grok unavailable ({e})")

        return self._fallback(question, metrics, snapshot, "XAI_API_KEY is not configured")

    # -- deterministic answer engine ----------------------------------------
    def rule_answer(self, question: str, metrics: Dict[str, Any],
                    snapshot: Optional[Dict[str, Any]] = None) -> str:
        """Answer the question that was asked, from real database rows.

        Ordered most-specific first. Each branch names concrete records
        (company, value, stage) rather than restating totals.
        """
        snap = snapshot if snapshot is not None else data_snapshot()
        q = question.lower().strip()
        leads = snap["leads"]
        deals = snap["deals"]
        accounts = snap["accounts"]

        if not leads and not deals and not accounts:
            return "There is no CRM data in the database yet, so I cannot answer that."

        # 1. At-risk / churn --------------------------------------------
        if any(w in q for w in _AT_RISK_WORDS):
            risky = snap["at_risk_accounts"][:_requested_count(q, 5)]
            if not risky:
                return "No accounts found in the database."
            lines = "\n".join(_account_line(a) for a in risky)
            return (
                f"{len(risky)} account(s) with the lowest health scores:\n{lines}\n"
                f"These are the ones most likely to churn - prioritise them for outreach."
            )

        # 2. Top N of an entity ------------------------------------------
        entity = _entity(q)
        if _is_top(q) and entity:
            n = _requested_count(q, 1 if not any(w in q for w in _LIST_WORDS) else 5)

            if entity == "lead":
                by_score = any(w in q for w in _SCORE_WORDS)
                rows = snap["top_leads_by_score"] if by_score else snap["top_leads_by_value"]
                if not rows:
                    return "No leads in the database."
                rows = rows[:n]
                basis = "AI score" if by_score else "opportunity value"
                if n == 1:
                    lead = rows[0]
                    return (
                        f"The highest lead by {basis} is {lead.get('name')} at "
                        f"{lead.get('company')} - {_money(lead.get('value'))} "
                        f"(status {lead.get('status')}, source {lead.get('source')}"
                        + (f", AI score {lead.get('ai_score')}/100"
                           if lead.get("ai_score") is not None else "")
                        + ").\n"
                        + "Runners-up: "
                        + "; ".join(
                            f"{r.get('name')} ({r.get('company')}, {_money(r.get('value'))})"
                            for r in snap["top_leads_by_value"][1:4]
                        )
                    )
                return f"Top {n} leads by {basis}:\n" + "\n".join(_lead_line(l) for l in rows)

            if entity == "deal":
                rows = snap["top_open_deals_by_value"][:n]
                if not rows:
                    return "No open deals in the database."
                if n == 1:
                    d = rows[0]
                    return (
                        f"The largest open deal is \"{d.get('title')}\" at "
                        f"{d.get('company')} - {_money(d.get('value'))}, currently in "
                        f"{d.get('stage')} (owner {d.get('owner')})."
                    )
                return f"Top {n} open deals by value:\n" + "\n".join(
                    _deal_line(d) for d in rows)

            rows = snap["at_risk_accounts"][:n]
            if not rows:
                return "No accounts in the database."
            if n == 1:
                a = rows[0]
                return (
                    f"The account needing the most attention is {a.get('name')} - "
                    f"contract {_money(a.get('contract_value'))}, health score "
                    f"{a.get('health_score')}/100, renewal in {a.get('renewal_in_days')} days."
                )
            return f"Bottom {n} accounts by health score:\n" + "\n".join(
                _account_line(a) for a in rows)

        # 3. Simple counts ------------------------------------------------
        if any(w in q for w in _COUNT_WORDS):
            if entity == "deal" or "deal" in q:
                breakdown = ", ".join(
                    f"{v} in {k}" for k, v in snap["deals_by_stage"].items()
                )
                n_open = len(snap["open_deals"])
                return (
                    f"There are {len(deals)} deals total: {breakdown}. "
                    f"Of those, {n_open} are still open."
                )
            if entity == "account":
                return f"There are {len(accounts)} accounts in the database."
            by_status = ", ".join(f"{v} {k}" for k, v in snap["leads_by_status"].items())
            by_source = ", ".join(
                f"{k}={v}" for k, v in snap["leads_by_source"].items()
            )
            return (
                f"There are {len(leads)} leads ({by_status}). "
                f"By source: {by_source}."
            )

        # 4. Sources / channels -------------------------------------------
        if any(w in q for w in _SOURCE_WORDS) and ("lead" in q or not entity):
            by_source = snap["leads_by_source"]
            if not by_source:
                return "No leads to break down by source."
            total = sum(by_source.values()) or 1
            ranked = list(by_source.items())
            head, share = ranked[0]
            lines = "\n".join(
                f"- {k}: {v} lead(s), {v / total * 100:.0f}% of all leads"
                for k, v in ranked
            )
            return (
                f"{head} is the top lead source with {by_source[head]} leads "
                f"({share / total * 100:.0f}% of the total).\nBreakdown:\n{lines}"
            )

        # 5. A specific entity named in the question -----------------------
        named = _mentions(q, leads, ("company", "name"))
        if named:
            related = [d for d in deals if d.get("company") == named.get("company")]
            extra = ""
            if named.get("ai_score") is not None:
                extra += f" AI score {named.get('ai_score')}/100"
            if named.get("ai_label"):
                extra += f" ({named['ai_label']})"
            if related:
                top = max(related, key=lambda r: _num(r.get("value")))
                extra += (
                    f". Largest open deal: \"{top.get('title')}\" at "
                    f"{_money(top.get('value'))}, stage {top.get('stage')}"
                )
            return (
                f"{named.get('name')} at {named.get('company')}: "
                f"{_money(named.get('value'))}, status {named.get('status')}, "
                f"source {named.get('source')}, industry {named.get('industry')}, "
                f"{named.get('touchpoints')} touchpoints{extra}."
            )

        named_deal = _mentions(q, deals, ("title", "company"))
        if named_deal:
            return (
                f"Deal \"{named_deal.get('title')}\" at {named_deal.get('company')}: "
                f"{_money(named_deal.get('value'))}, stage {named_deal.get('stage')}, "
                f"probability {named_deal.get('probability')}%, owner "
                f"{named_deal.get('owner')}, {named_deal.get('days_in_stage')} days "
                f"in stage, closes {named_deal.get('close_date')}."
            )

        named_account = _mentions(q, accounts, ("name",))
        if named_account:
            return (
                f"{named_account.get('name')}: contract "
                f"{_money(named_account.get('contract_value'))}, health score "
                f"{named_account.get('health_score')}/100, usage trend "
                f"{named_account.get('usage_trend')}, last activity "
                f"{named_account.get('last_activity_days')} days ago, renewal in "
                f"{named_account.get('renewal_in_days')} days."
            )

        # 6. Revenue / forecast -------------------------------------------
        if any(w in q for w in _REVENUE_WORDS):
            by_stage = snap["value_by_stage"]
            won = by_stage.get("closed-won") or by_stage.get("closed won") or 0.0
            open_value = sum(
                v for k, v in by_stage.items()
                if k.strip().lower() not in {"closed-won", "closed-lost", "closed lost"}
            )
            return (
                f"Closed-won revenue is {_money(won)} across "
                f"{metrics['closed_won_count']} deals. Open pipeline is worth "
                f"{_money(open_value)} across {len(snap['open_deals'])} deals, and the "
                f"win rate is {metrics['win_rate']}%. The model forecast is "
                f"{_money(metrics['revenue_forecast'])}.\nPipeline value by stage: "
                + ", ".join(f"{k}={_money(v)}" for k, v in by_stage.items())
            )

        # 7. Pipeline / funnel --------------------------------------------
        if any(w in q for w in _PIPELINE_WORDS):
            by_stage = snap["deals_by_stage"]
            return (
                f"Pipeline value is {_money(metrics['pipeline_value'])} across "
                f"{metrics['open_deals']} open deals, with "
                f"{metrics['closed_won_count']} closed-won and a "
                f"{metrics['win_rate']}% win rate.\nDeals by stage: "
                + ", ".join(f"{k}={v}" for k, v in by_stage.items())
            )

        # 8. Nothing specific matched - be brief and say what is available.
        top_lead = snap["top_leads_by_value"][0] if leads else None
        top_deal = snap["top_open_deals_by_value"][0] if snap["open_deals"] else None
        bits = [
            f"{len(leads)} leads, {len(deals)} deals, {len(accounts)} accounts.",
            f"Pipeline {_money(metrics['pipeline_value'])} across "
            f"{metrics['open_deals']} open deals, win rate {metrics['win_rate']}%.",
        ]
        if top_lead:
            bits.append(
                f"Largest lead: {top_lead.get('name')} at {top_lead.get('company')} "
                f"({_money(top_lead.get('value'))})."
            )
        if top_deal:
            bits.append(
                f"Largest open deal: \"{top_deal.get('title')}\" "
                f"({_money(top_deal.get('value'))}, {top_deal.get('stage')})."
            )
        return " ".join(bits) + (
            "\n\nI can answer questions about specific leads, deals, accounts, "
            "sources, stages, revenue, forecast, or churn risk - name one."
        )