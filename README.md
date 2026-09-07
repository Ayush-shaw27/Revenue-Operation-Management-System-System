# RevOps Pro — AI/ML Production Platform

Modern Revenue Operations & Sales Intelligence platform.

- Frontend: Next.js 15 + React 19 + Tailwind + TypeScript
- Backend: FastAPI (async) + SQLAlchemy + SQLite
- ML: Scikit-Learn (lead scoring, churn, anomaly, revenue forecast, Ridge/GB)
- Real-time: SSE EventBus (`backend/realtime.py`), AP-Scheduler (`backend/scheduler.py`)
- AI Copilot: `backend/copilot.py` (rule + LLM provider)

## What We Have (Implemented)

- SQLAlchemy DB layer (`backend/db.py`, models, seed CSV → DB)
- Persistence layer (`backend/data_store.py`), seed loader + fetch
- Real-time event hub + SSE (`backend/realtime.py`, `frontend/hooks/use-events.ts`)
- Scheduler with 60s jobs (`backend/scheduler.py`, `backend/jobs.py`)
- Retrain pipeline fixed (`backend/retrain_model.py`), revenue forecast naming fixed (`ridge` / `gradient-boosting`), lead scoring explainability (`top_feature_contributions`)
- Alert engine event-driven (`evaluate_entity` / `evaluate_account`)
- Visual overhaul: glass-card / glow-hover / orb theme tokens (`frontend/app/globals.css`), reskinned dashboard + animated orbs
- AI Copilot endpoint (`POST /api/copilot/ask`), Executive Summary (`GET /api/analytics/exec-summary`), Scenario Simulator (`POST /api/analytics/forecast-scenario`)
- Role-based server-side filtering (`sales-executive` / `admin`)
- README with ASCII architecture, endpoint reference, setup

## Architecture (ASCII)

[Next.js Frontend] <--SSE--> [FastAPI Backend] <---> [SQLite / SQLAlchemy]
        |                    |                         |
   hooks/use-events     scheduler + jobs       seed_loader / data_store
        |                    |                         |
   EventBus <-------- realtime.py <-------- ML models (lead, revenue, churn, anomaly)

## Setup (Single venv: venv/)

```powershell
# One venv only — venv2 removed
# If needed: python -m venv venv
.\venv\Scripts\activate
pip install -r backend/requirements.txt
# Run
python -m uvicorn backend.main:app --reload
# Or use start_all.ps1 (check it first)
```

## Validation Commands (per plan)

```powershell
# After backend/model changes
python -m pytest backend/test_api.py -v --tb=short
# After visual changes
npx tsc --noEmit
# DB seed check: delete backend/revops.db before testing
```

## Endpoint Reference

- `GET /api/admin/stats` — psutil live stats
- `POST /api/admin/models/{name}/retrain` — lead / revenue / churn / anomaly
- `GET /api/events/stream?token=` — SSE events
- `POST /api/copilot/ask` — AI copilot
- `GET /api/analytics/exec-summary` — executive summary
- `GET /api/analytics/revenue-history` — historical closed-won
- `POST /api/analytics/forecast-scenario` — scenario sim (discount, headcount, factor)

## Demo Accounts (seeded)
- Admin: `admin / revops2025` (role=admin)
- Sales Executive: `sales / revops2025` (role=sales-executive)
- To seed: `python -c "from backend.seed_loader import seed_if_empty; seed_if_empty()"`; delete `backend/revops.db` first for fresh seed.

## Notes

- Use `Set-Location '...revops-platform(Final)'` for paths with spaces; avoid `&&` in PowerShell 5.1.
- Circular import guard: `data_store` uses `get_session()` not module-level `auth` import.
- All code edits verified via `py_compile`; `pytest` runs when `fastapi` installed in active `venv`.
