"""backend/data_generator.py
Deterministic, seeded CSV generator producing correlated, realistic data:
~400 leads, ~120 deals, ~60 accounts, ~300 activities, 3 demo users.

Run standalone: python -m backend.data_generator
Produces CSVs in backend/seed/.
"""
import csv
import os
import random as _random
from typing import List, Dict, Any

import numpy as np
import bcrypt

SEED_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed")

# ── Curated company list (~80 well-known companies across industries) ────────
COMPANIES: Dict[str, List[str]] = {
    "Technology": [
        "Acme Corp", "TechStart Inc", "Innovate.io", "CloudBase Systems",
        "NexGen Software", "Quantum Dynamics", "ByteForge Labs", "DataStream Co",
        "CyberShield Security", "CodePilot AI", "SiliconWave", "DevOps Central",
    ],
    "FinTech": [
        "FinEdge Capital", "PayStream Global", "WealthLogic", "InsureTech Pro",
        "CryptoVault Inc", "TradeFlow Systems", "LendSmart AI", "BankOS",
        "MoneyMagnet Co", "FiscalPath", "CreditLens", "PayBridge",
    ],
    "Healthcare": [
        "MedTech Solutions", "HealthSync Pro", "BioData Analytics", "PharmaEdge",
        "CareFlow Systems", "VitalSign AI", "HealthBridge", "NeuroLink Medical",
        "GenomeTech", "PulsePoint Health", "MediVault", "ClinicalEdge",
    ],
    "Retail": [
        "ShopSphere", "RetailOps Pro", "CartGenius", "OmniChannel Co",
        "StoreSync AI", "PriceWatch", "FulfillmentHub", "ConsumerPulse",
        "BrandForge", "MarketReach", "QuickShip Pro", "DemandFlow",
    ],
    "Manufacturing": [
        "FactoryLine Pro", "SupplyChain360", "PrecisionWorks", "IndustrialEdge",
        "AutoMation Hub", "SmartFactory AI", "ProcessFlow", "MetalCraft Systems",
        "BuildRight Materials", "ProtoTech Industries", "MoldMaster Pro", "GearWorks",
    ],
    "SaaS": [
        "SaaSify", "CloudNine Platform", "ScaleUp Tools", "DataNest",
        "AgileStack", "PlatformHQ", "MetricFlow", "WorkPilot",
        "TaskForge", "PipelinePro", "InsightEngine", "GrowthStack",
    ],
}

INDUSTRIES = list(COMPANIES.keys())

NAMES_FIRST = [
    "James", "Sarah", "Michael", "Emily", "David", "Jessica", "Robert", "Ashley",
    "William", "Jennifer", "Thomas", "Maria", "Daniel", "Linda", "Christopher",
    "Patricia", "Matthew", "Elizabeth", "Andrew", "Susan", "Joseph", "Margaret",
    "Mark", "Dorothy", "Steven", "Lisa", "Paul", "Nancy", "Kenneth", "Karen",
    "Brian", "Betty", "George", "Helen", "Edward", "Sandra", "Ronald", "Donna",
    "Anthony", "Carol", "Kevin", "Ruth", "Jason", "Sharon", "Timothy", "Michelle",
    "Jeffrey", "Laura", "Frank", "Kimberly", "Scott", "Deborah", "Eric", "Diana",
    "Stephen", "Catherine", "Jacob", "Christine", "Nicholas", "Marie",
]

NAMES_LAST = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Rodriguez", "Martinez", "Anderson", "Taylor", "Thomas",
    "Moore", "Jackson", "Martin", "Lee", "Thompson", "White", "Harris",
    "Clark", "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
    "Wright", "Scott", "Green", "Baker", "Adams", "Nelson", "Hill",
    "Ramirez", "Campbell", "Mitchell", "Roberts", "Carter", "Phillips",
    "Evans", "Turner", "Torres", "Parker", "Collins", "Edwards",
    "Stewart", "Flores", "Morris", "Nguyen", "Murphy", "Rivera",
]

SOURCES = ["Website", "LinkedIn", "Referral", "Email Campaign", "Cold Outreach", "Event"]
SOURCE_WEIGHTS = [0.25, 0.25, 0.2, 0.15, 0.1, 0.05]

COMPANY_SIZES = ["Startup", "Mid-Market", "Enterprise"]
SIZE_WEIGHTS = [0.3, 0.45, 0.25]

LEAD_STATUSES = ["new", "contacted", "qualified", "converted"]
STAGES = ["prospecting", "qualification", "proposal", "negotiation", "closed-won", "closed-lost"]

DEMO_USERS = [
    {"id": "u1", "name": "John Smith", "email": "admin@revops.pro", "password": "adminpass", "role": "admin"},
    {"id": "u2", "name": "Sarah Johnson", "email": "manager@revops.pro", "password": "managerpass", "role": "manager"},
    {"id": "u3", "name": "Mike Chen", "email": "rep@revops.pro", "password": "reppass", "role": "sales-executive"},
]

ACTIVITY_TYPES = ["call", "email", "note", "stage_change"]
ACTIVITY_CONTENT = {
    "call": [
        "Discovery call with procurement — budget confirmed for Q1.",
        "Follow-up call: technical requirements clarified.",
        "Intro call — stakeholder alignment meeting scheduled.",
        "Negotiation call — pricing terms discussed.",
        "Check-in call — product demo feedback positive.",
        "Executive sponsor call — committed to Q1 close.",
        "Architecture review call — integration requirements mapped.",
        "Renewal discussion — expansion opportunity identified.",
    ],
    "email": [
        "Sent proposal v2 with security addendum.",
        "Case study and ROI analysis shared with decision-maker.",
        "Technical documentation package delivered.",
        "Pricing tier breakdown sent for review.",
        "Onboarding timeline and SOW delivered.",
        "Follow-up email with competitive analysis.",
        "Thank you note post-demo with next steps.",
    ],
    "note": [
        "Contact prefers email outreach. CTO is the economic buyer.",
        "Competitor evaluation underway — 3 vendors shortlisted.",
        "Budget approved for Q2. Legal review in progress.",
        "Decision maker on leave until next month.",
        "Pilot program agreed — 30-day evaluation.",
        "Internal champion identified — VP of Engineering.",
    ],
    "stage_change": [
        "Stage progression confirmed by account owner.",
        "Moved forward after successful technical validation.",
    ],
}


def _generate_user_csv(path: str, rng: _random.Random):
    rows = []
    for user in DEMO_USERS:
        hashed = bcrypt.hashpw(user["password"].encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        rows.append({
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "hashed_password": hashed,
            "role": user["role"],
            "status": "active",
            "last_login": "2024-01-19 14:30",
            "created_at": "2024-01-01",
        })
    _write_csv(path, rows)


def _generate_leads_csv(path: str, rng: np.random.Generator) -> List[Dict[str, Any]]:
    rows = []
    all_companies = []
    for ind, names in COMPANIES.items():
        for c in names:
            all_companies.append((c, ind))

    statuses_weights = [0.3, 0.25, 0.25, 0.2]
    owners = ["John Smith", "Sarah Johnson", "Mike Chen"]

    for i in range(400):
        company, industry = all_companies[int(rng.integers(0, len(all_companies)))]
        first = NAMES_FIRST[int(rng.integers(0, len(NAMES_FIRST)))]
        last = NAMES_LAST[int(rng.integers(0, len(NAMES_LAST)))]
        source = rng.choice(SOURCES, p=SOURCE_WEIGHTS)
        company_size = rng.choice(COMPANY_SIZES, p=SIZE_WEIGHTS)
        value = float(rng.exponential(45000)) + 5000
        value = round(value, 2)
        touchpoints = int(rng.poisson(4)) + 1
        status = rng.choice(LEAD_STATUSES, p=statuses_weights)

        # AI scoring heuristic (matches model logic)
        source_w = {"Referral": 0.4, "Website": 0.25, "LinkedIn": 0.2, "Email Campaign": 0.1, "Event": 0.3, "Cold Outreach": -0.1}
        size_w = {"Enterprise": 0.35, "Mid-Market": 0.2, "Startup": 0.05}
        logit = (value / 100000) * 0.4 + (touchpoints / 10) * 0.6 + source_w.get(source, 0) + size_w.get(company_size, 0) + float(rng.normal(0, 0.2))
        prob = 1 / (1 + np.exp(-logit))
        ai_score = int(np.clip(round(prob * 100), 1, 99))
        if ai_score >= 80:
            ai_label = "Hot"
        elif ai_score >= 60:
            ai_label = "Warm"
        elif ai_score >= 40:
            ai_label = "Cool"
        else:
            ai_label = "Cold"

        ai_factors = []
        if value >= 50000:
            ai_factors.append("High deal value potential")
        elif value < 15000:
            ai_factors.append("Lower contract value tier")
        if source in ["Referral", "Website", "Event"]:
            ai_factors.append(f"Strong inbound channel ({source})")
        else:
            ai_factors.append(f"Outbound acquisition ({source})")
        if touchpoints >= 4:
            ai_factors.append("High multi-touch engagement")
        else:
            ai_factors.append("Early stage engagement")
        if company_size == "Enterprise":
            ai_factors.append("Enterprise buying power")

        day = int(rng.integers(1, 28))
        month = int(rng.integers(1, 13))
        created_at = f"2024-{month:02d}-{day:02d}"

        row = {
            "id": f"l{i+1}",
            "name": f"{first} {last}",
            "email": f"{first.lower()}.{last.lower()}@{company.lower().replace(' ', '').replace('.', '')}.com",
            "phone": f"+1 (555) {int(rng.integers(100, 999))}-{int(rng.integers(1000, 9999))}",
            "company": company,
            "status": status,
            "source": source,
            "value": value,
            "industry": industry,
            "company_size": company_size,
            "touchpoints": touchpoints,
            "notes": "",
            "created_at": created_at,
            "ai_score": ai_score,
            "ai_label": ai_label,
            "ai_factors": str(ai_factors),
        }
        rows.append(row)

    _write_csv(path, rows)
    return rows


def _generate_deals_csv(path: str, leads: List[Dict[str, Any]], rng: np.random.Generator) -> List[Dict[str, Any]]:
    rows = []
    owners = ["John Smith", "Sarah Johnson", "Mike Chen"]
    stage_probs = [0.25, 0.20, 0.20, 0.15, 0.10, 0.10]
    stage_base_prob = {"prospecting": 25, "qualification": 40, "proposal": 60, "negotiation": 75, "closed-won": 95, "closed-lost": 10}

    # Pick ~120 leads that become deals
    deal_indices = rng.choice(len(leads), size=min(120, len(leads)), replace=False)

    for i, idx in enumerate(deal_indices):
        lead = leads[idx]
        stage = rng.choice(STAGES, p=stage_probs)
        probability = stage_base_prob[stage] + int(rng.integers(-5, 10))
        probability = max(5, min(99, probability))
        value = lead["value"] * (1 + float(rng.normal(0, 0.2)))
        value = round(max(5000, value), 2)
        owner = rng.choice(owners)
        days_in_stage = int(rng.integers(1, 35))
        is_anomalous = days_in_stage > 25 or (value > 150000 and stage in ["qualification", "proposal"] and days_in_stage > 14)

        day = int(rng.integers(1, 28))
        month = int(rng.integers(1, 13))
        created_at = f"2024-{month:02d}-{day:02d}"
        close_month = min(12, month + int(rng.integers(1, 4)))
        close_date = f"2024-{close_month:02d}-{int(rng.integers(1, 28)):02d}"

        title_templates = [
            f"{lead['company']} Enterprise License",
            f"{lead['company']} Platform Migration",
            f"{lead['company']} Digital Transformation",
            f"{lead['company']} Security Audit",
            f"{lead['company']} Cloud Migration",
            f"{lead['company']} Data Analytics Suite",
            f"{lead['company']} Automation Platform",
            f"{lead['company']} Integration Project",
        ]
        title = rng.choice(title_templates)

        row = {
            "id": f"d{i+1}",
            "title": title,
            "company": lead["company"],
            "value": value,
            "probability": probability,
            "owner": owner,
            "close_date": close_date,
            "stage": stage,
            "ai_recommendation": "",
            "is_anomalous": str(is_anomalous),
            "days_in_stage": days_in_stage,
            "last_stage_change": "",
            "created_at": created_at,
        }
        rows.append(row)

    _write_csv(path, rows)
    return rows


def _generate_accounts_csv(path: str, rng: np.random.Generator) -> List[Dict[str, Any]]:
    rows = []
    # Pick 60 unique companies for accounts
    all_companies = []
    for ind, names in COMPANIES.items():
        for c in names:
            all_companies.append((c, ind))

    indices = rng.choice(len(all_companies), size=60, replace=False)

    for i, idx in enumerate(indices):
        company, industry = all_companies[idx]
        contract_value = float(rng.exponential(90000)) + 10000
        contract_value = round(contract_value, 2)
        last_activity_days = int(rng.exponential(25))
        usage_trend = float(rng.normal(-0.1, 0.3))
        ticket_count = int(rng.poisson(6))
        renewal_in_days = int(rng.exponential(80)) + 1

        # Health score heuristic
        health = 1.0
        health -= min(last_activity_days / 90, 0.4)
        health -= min(max(-usage_trend, 0) * 0.5, 0.3)
        health -= min(ticket_count / 25, 0.2)
        health -= min(max(0, 45 - renewal_in_days) / 45 * 0.3, 0.3)
        health = round(max(0.05, min(1.0, health + float(rng.normal(0, 0.05)))), 2)

        row = {
            "id": f"c{i+1}",
            "name": company,
            "industry": industry,
            "contract_value": contract_value,
            "last_activity_days": last_activity_days,
            "usage_trend": round(usage_trend, 2),
            "ticket_count": ticket_count,
            "renewal_in_days": renewal_in_days,
            "health_score": health,
        }
        rows.append(row)

    _write_csv(path, rows)
    return rows


def _generate_activities_csv(path: str, leads: List[Dict[str, Any]], deals: List[Dict[str, Any]], rng: np.random.Generator):
    rows = []
    activity_id = 1
    owners = ["John Smith", "Sarah Johnson", "Mike Chen"]

    # ~300 activities tied to deals/leads
    for _ in range(300):
        atype = rng.choice(ACTIVITY_TYPES, p=[0.3, 0.25, 0.3, 0.15])
        content = rng.choice(ACTIVITY_CONTENT[atype])
        author = rng.choice(owners)

        # Randomly assign to a deal or a lead
        if rng.random() < 0.6 and deals:
            deal = deals[int(rng.integers(0, len(deals)))]
            deal_id = deal["id"]
            lead_id = ""
        elif leads:
            lead = leads[int(rng.integers(0, len(leads)))]
            lead_id = lead["id"]
            deal_id = ""
        else:
            deal_id = ""
            lead_id = ""

        month = int(rng.integers(1, 13))
        day = int(rng.integers(1, 28))
        hour = int(rng.integers(8, 18))
        minute = int(rng.integers(0, 60))
        created_at = f"2024-{month:02d}-{day:02d} {hour:02d}:{minute:02d}:00"

        rows.append({
            "id": f"ac{activity_id}",
            "deal_id": deal_id,
            "lead_id": lead_id,
            "type": atype,
            "author": author,
            "content": content,
            "created_at": created_at,
        })
        activity_id += 1

    _write_csv(path, rows)


def _write_csv(path: str, rows: List[Dict[str, Any]]):
    if not rows:
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)


def generate_all():
    """Generate all seed CSV files."""
    os.makedirs(SEED_DIR, exist_ok=True)

    rng_np = np.random.default_rng(42)
    rng_py = _random.Random(42)

    _generate_user_csv(os.path.join(SEED_DIR, "users.csv"), rng_py)
    leads = _generate_leads_csv(os.path.join(SEED_DIR, "leads.csv"), rng_np)
    deals = _generate_deals_csv(os.path.join(SEED_DIR, "deals.csv"), leads, rng_np)
    _generate_accounts_csv(os.path.join(SEED_DIR, "accounts.csv"), rng_np)
    _generate_activities_csv(os.path.join(SEED_DIR, "activities.csv"), leads, deals, rng_np)

    print(f"Seed data generated in {SEED_DIR}")
    print(f"  users:      3")
    print(f"  leads:      {len(leads)}")
    print(f"  deals:      {len(deals)}")
    print(f"  accounts:   60")
    print(f"  activities: 300")


if __name__ == "__main__":
    generate_all()
