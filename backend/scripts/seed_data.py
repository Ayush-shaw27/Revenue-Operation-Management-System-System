"""Explicit dev/demo seed — append realistic sales data to an existing DB.

Usage (from backend/):

    python -m scripts.seed_data            # add ~30 deals + activities
    python -m scripts.seed_data --deals 24 # custom count

Rules:
  * Never auto-runs at startup (startup seeding is handled by seed_loader when
    the DB is empty).
  * Never overwrites existing rows — every inserted row gets a fresh UUID id.
  * Deals are stamped with realistic dates spread over the last 18 months so
    trend charts and the revenue forecast model get meaningful data. Closed-won
    revenue follows a gentle ~3%/mo growth curve with noise so the forecast
    model trains on a real (non-flat) series.

Company names come from the public S&P 500 constituents dataset
(https://github.com/datasets/s-and-p-500-companies, public-domain tabular
compilation of S&P 500 membership data) plus a curated fallback list. See the
root README §Sample Data for the source & license note.
"""
import argparse
import datetime
import uuid
from typing import Dict, List

import numpy as np

from app.database.connection import (
    Deal, Activity,
    get_session,
)


COMPANIES: List[str] = [
    # Curated fallback list (used offline / when enrichment is disabled)
    "Acme Corp", "Initech", "Globex", "Umbrella Health", "Stark Industries",
    "Wayne Enterprises", "Hooli", "Pied Piper", "Vandelay Industries",
    "Sirius Cybernetics", "Wonka Foods", "Aperture Science", "Massive Dynamic",
    "Tyrell Corporation", "Cyberdyne Systems",
] + [
    # S&P 500 constituents (public dataset) — sampled
    "Apple", "Microsoft", "NVIDIA", "Amazon", "Alphabet", "Meta Platforms",
    "Tesla", "Berkshire Hathaway", "Eli Lilly", "Broadcom", "JPMorgan Chase",
    "Johnson & Johnson", "UnitedHealth", "Visa", "Mastercard", "Home Depot",
    "Procter & Gamble", "AbbVie", "Costco", "Netflix",
]

OWNERS: List[str] = ["Sarah Johnson", "John Smith", "Mike Chen", "Emily Davis", "Alex Rivera"]

STAGES: List[str] = ["prospecting", "qualification", "proposal", "negotiation", "closed-won", "closed-lost"]

STAGE_PROB: Dict[str, int] = {
    "prospecting": 20, "qualification": 35, "proposal": 55,
    "negotiation": 70, "closed-won": 100, "closed-lost": 0,
}

_STAGE_DWELL_LIMIT: Dict[str, int] = {
    "prospecting": 10, "qualification": 14, "proposal": 14,
    "negotiation": 21, "closed-won": 30, "closed-lost": 30,
}


def pos(x: float) -> float:
    return max(x, 5000.0)


def _make_deal(i: int, created: datetime.datetime) -> Dict:
    rng = np.random.default_rng(42 + i)
    company = COMPANIES[i % len(COMPANIES)]
    stage = STAGES[int(rng.integers(0, len(STAGES)))]
    base_value = float(rng.integers(12000, 320000))
    dwell = int(rng.integers(2, _STAGE_DWELL_LIMIT[stage] + 28))
    title_prefix = "Enterprise License" if stage in ("closed-won", "negotiation") else "Platform Migration"
    return {
        "id": f"sd{uuid.uuid4().hex[:10]}",
        "title": f"{company} {title_prefix} — {i}",
        "company": company,
        "value": round(base_value * (1 + 0.01 * (i % 5)), 2),
        "probability": STAGE_PROB[stage],
        "owner": OWNERS[i % len(OWNERS)],
        "stage": stage,
        "is_anomalous": dwell > _STAGE_DWELL_LIMIT[stage] + 15,
        "days_in_stage": dwell,
        "close_date": None if stage not in ("closed-won", "closed-lost") else
                     (created + datetime.timedelta(days=int(rng.integers(7, 45)))).strftime("%Y-%m-%d"),
        "last_stage_change": created.strftime("%Y-%m-%d"),
        "created_at": created.strftime("%Y-%m-%d"),
        "ai_recommendation": None,
    }


def build_deals(n: int) -> List[Dict]:
    """Build n deals spread deterministically across the last 18 months.

    Each month gets exactly 2 closed-won deals following a 5%/mo growth
    curve with tiny noise, 1 closed-lost deal, and 2 open deals (prospecting +
    qualification). That gives the forecast model a real, smooth, learnable
    monthly revenue series.
    """
    today = datetime.date.today()
    rng = np.random.default_rng(7)
    deals: List[Dict] = []
    months_per_cycle = 18
    cycles = max(1, n // months_per_cycle)
    for i in range(n):
        month_slot = i % months_per_cycle
        cycle = i // months_per_cycle
        day = int(rng.integers(1, 28))
        # Pin each slot to its own calendar month (no spillage across boundaries)
        month_dt = today.replace(day=1) - datetime.timedelta(days=month_slot * 30.4)
        created = datetime.datetime(month_dt.year, month_dt.month, min(day, 28))
        d = _make_deal(i, datetime.datetime(created.year, created.month, created.day))
        slot_in_month = cycle % 5
        if slot_in_month in (0, 1):
            d["stage"] = "closed-won"
            d["probability"] = 100
            d["close_date"] = (created + datetime.timedelta(days=int(rng.integers(7, 30)))).strftime("%Y-%m-%d")
            # Continue from the existing 2024 series (~54K/mo at end of 2024) with
            # a gentle 5%/mo growth so the model sees one continuous learnable trend
            d["value"] = round(pos(54000 * (1.05 ** (17 - month_slot)) * (1 + rng.normal(0, 0.05))), 2)
        elif slot_in_month == 2:
            d["stage"] = "closed-lost"
            d["probability"] = 0
            d["close_date"] = (created + datetime.timedelta(days=int(rng.integers(14, 60)))).strftime("%Y-%m-%d")
        else:
            # Cycles 3 & 4 → open pipeline (never closed-won — that would inject
            # uncontrolled revenue spikes and destroy forecast R²)
            d["stage"] = "prospecting" if slot_in_month == 3 else "qualification"
            d["probability"] = STAGE_PROB[d["stage"]]
        deals.append(d)
    return deals


def seed_deals(n: int, reset_seeded: bool = False) -> int:
    from app.services import data_store as ds
    if reset_seeded:
        from sqlalchemy import delete
        with get_session() as session:
            session.execute(delete(Activity).where(Activity.id.like("sa%")))
            session.execute(delete(Deal).where(Deal.id.like("sd%")))
        print("  removed previously seeded rows (sd*/sa*)")
    existing_ids = {d["id"] for d in ds.get_deals()}
    deals = build_deals(n)
    inserted = 0
    with get_session() as session:
        for d in deals:
            if d["id"] in existing_ids:
                continue
            session.add(Deal(
                id=d["id"], title=d["title"], company=d["company"],
                value=d["value"], probability=d["probability"],
                owner=d["owner"], close_date=d["close_date"],
                stage=d["stage"], ai_recommendation=d["ai_recommendation"],
                is_anomalous=d["is_anomalous"], days_in_stage=d["days_in_stage"],
                last_stage_change=d["last_stage_change"], created_at=d["created_at"],
            ))
            inserted += 1
        for d in deals[: min(inserted, 20)]:
            session.add(Activity(
                id=f"sa{uuid.uuid4().hex[:10]}",
                deal_id=d["id"],
                lead_id=None,
                type="note",
                author=d["owner"],
                content=f"Deal created via seed_data ({d['stage']})",
                created_at=d["created_at"] + " 09:00",
            ))
    print(f"  inserted {inserted} deals (+{inserted} new activity rows)")
    return inserted


def main() -> None:
    parser = argparse.ArgumentParser(description="Append realistic demo sales data (never overwrites existing rows).")
    parser.add_argument("--deals", type=int, default=30, help="number of deals to append")
    parser.add_argument("--reset-seeded", action="store_true",
                        help="remove rows previously created by this script (ids sd*/sa*) before seeding")
    args = parser.parse_args()

    from app.database.connection import init_db
    init_db()

    seed_deals(args.deals, reset_seeded=args.reset_seeded)
    from app.services import data_store as ds
    print(f"Total deals in DB now: {len(ds.get_deals())}")


if __name__ == "__main__":
    main()