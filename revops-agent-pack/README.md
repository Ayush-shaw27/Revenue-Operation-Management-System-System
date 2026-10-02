# RevOps Pro

AI-assisted Revenue Operations platform: lead scoring, churn and anomaly detection, revenue forecasting, pipeline analytics, alerts, and a metric-grounded copilot. FastAPI + SQLite backend, Next.js 15 frontend.

> **Status (2026-09-21):** an end-to-end audit found startup and frontend defects (see [`CHECKPOINT.md`](CHECKPOINT.md)). Items marked ⚠ below are being fixed. Update this file as tasks complete.

Docs: [`CLAUDE.md`](CLAUDE.md) (rules & intent) · [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`DESIGN.md`](DESIGN.md) · [`AGENTS.md`](AGENTS.md) · [`MEMORY.md`](MEMORY.md) · [`CHECKPOINT.md`](CHECKPOINT.md) · [`CHANGELOG.md`](CHANGELOG.md)

---

## 1. Stack

| Layer | Tech |
|---|---|
| Backend | Python, FastAPI, SQLAlchemy, SQLite (`backend/data/revops.db`), JWT + bcrypt, APScheduler, SSE |
| ML | scikit-learn 1.9.0 (lead scoring, churn, anomaly detection, revenue forecast), joblib artifacts |
| AI | OmniRoute (OpenAI-compatible gateway), called **server-side only** |
| Frontend | Next.js 15.2.4 (App Router), React 18.3.1, Tailwind 3.4, Framer Motion 11.11.17, Chart.js |

## 2. Prerequisites

- Python 3.12+ (developed on 3.14) · Node.js 20+ · npm · Git
- Windows PowerShell commands shown; macOS/Linux equivalents in `scripts/start-dev.sh`

## 3. Quick start (Windows PowerShell)

**Free the ports first** (stale servers cause `WinError 10048`):

```powershell
Get-NetTCPConnection -LocalPort 8000,3000 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

**Backend** — always run from `backend/`, inside `backend\.venv`:

```powershell
cd backend
python -m venv .venv                 # first time only
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt      # first time only
copy .env.example .env               # first time only, then edit values
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**Frontend** (second terminal):

```powershell
cd frontend
npm install                          # first time only
"NEXT_PUBLIC_API_URL=http://127.0.0.1:8000" | Out-File -Encoding ascii .env.local   # first time only
npm run dev
```

**One command:** `.\scripts\start-dev.ps1` (⚠ being hardened in T-003 — frees ports, uses `backend\.venv`).

The database is created and seeded on first start if empty. To reseed, stop the backend, back up then delete `backend/data/revops.db*`, restart.

## 4. URLs

| What | URL |
|---|---|
| Frontend (public site) | http://localhost:3000 |
| Login | http://localhost:3000/login |
| Dashboard | http://localhost:3000/dashboard |
| API root | http://127.0.0.1:8000/ |
| Health | http://127.0.0.1:8000/health · `/api/health` |
| Swagger UI | http://127.0.0.1:8000/docs |
| ReDoc | http://127.0.0.1:8000/redoc |
| OpenAPI JSON | http://127.0.0.1:8000/openapi.json |
| SSE stream | http://127.0.0.1:8000/api/events/stream |
| OmniRoute gateway | http://localhost:20128 (external tool; see `OMNIROUTE_BASE_URL`) |

<!-- LOCAL-CREDENTIALS:START -->
## 5. Login credentials — LOCAL DEV ONLY

> ⚠ **Delete this whole block (between the markers) before pushing this repo publicly**, and rotate/replace these accounts on any deployed instance. Create real users with `python scripts/create_user.py`.

These accounts exist in the seeded database and were verified to authenticate against it on 2026-09-21.

| Site / surface | Where | Email | Password | Role |
|---|---|---|---|---|
| Web app login | http://localhost:3000/login | `admin@revops.pro` | `adminpass` | admin (sees Admin page) |
| Web app login | http://localhost:3000/login | `manager@revops.pro` | `managerpass` | manager |
| Web app login | http://localhost:3000/login | `rep@revops.pro` | `reppass` | sales-executive |
| API / Swagger *Authorize* | http://127.0.0.1:8000/docs | same three accounts (`username` = the email) | | |
| OmniRoute dashboard | http://localhost:20128 | set when you installed OmniRoute — not stored in this repo | | |

Not credentials, and never written here: `JWT_SECRET_KEY`, `OMNIROUTE_API_KEY` (they live only in `backend/.env`).

Cleanup: `testadmin@revops.pro` is a leftover from test runs (unknown password) — delete it (task T-004).
<!-- LOCAL-CREDENTIALS:END -->

## 6. Roles & access

| Role | Can do |
|---|---|
| `sales-executive` | Read/write CRM (leads, deals, accounts, activities), predictions, alerts, copilot |
| `manager` | Same as above (no extra gates today) |
| `admin` | Everything, plus `/api/users*`, `/api/admin/*`, Admin dashboard page |

Login is OAuth2 password flow, **form-encoded** (`username`, `password`) — not JSON.

```powershell
curl.exe -X POST http://127.0.0.1:8000/api/auth/login -d "username=admin@revops.pro&password=adminpass"
curl.exe http://127.0.0.1:8000/api/leads -H "Authorization: Bearer <access_token>"
```

## 7. Environment variables

| File | Variable | Purpose |
|---|---|---|
| `backend/.env` | `DATABASE_URL` | default `sqlite:///./data/revops.db` |
| | `JWT_SECRET_KEY` | JWT signing secret — long random string, never commit |
| | `JWT_EXPIRE_MINUTES` | token lifetime (default 480) |
| | `OMNIROUTE_BASE_URL` | gateway base, e.g. `http://localhost:20128/v1` |
| | `OMNIROUTE_API_KEY` | gateway key — server-side only |
| | `OMNIROUTE_MODEL` | model/route name |
| | `CORS_ORIGINS` | comma-separated allowed origins (include `http://localhost:3000`, `http://127.0.0.1:3000`) |
| | `ENVIRONMENT` | `development` / `production` |
| | `SCHEDULER_ENABLED` | `1` enables APScheduler jobs |
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8000` |

`.env` and `.env.local` are git-ignored. `.env.example` files hold placeholders only.

## 8. Frontend routes

`/` landing · `/login` · `/dashboard` overview · `/dashboard/leads` · `/dashboard/pipeline` · `/dashboard/accounts` · `/dashboard/forecast` · `/dashboard/analytics` · `/dashboard/copilot` · `/dashboard/alerts` · `/dashboard/admin` (admin only).
Planned (T-010): `/platform`, `/pricing`, `/resources`, `/about`, `/contact`. There are **no** `/dashboard/deals` or `/dashboard/notifications` pages yet.

## 9. API summary (60 operations — full list at `/docs`)

| Group | Endpoints |
|---|---|
| Auth | `POST /api/auth/login` · `GET /api/auth/me` · `POST /api/auth/register` (⚠ must not grant admin — T-004) |
| Leads | `GET/POST /api/leads` · `GET/PUT/DELETE /api/leads/{id}` · `GET /api/leads/export` · `POST /api/leads/import` |
| Deals | `GET/POST /api/deals` · `GET/PUT/DELETE /api/deals/{id}` · `GET /api/deals/export` |
| Accounts | `GET /api/accounts` · `GET /api/accounts/{id}` · `GET /api/accounts/export` |
| Activities | `GET/POST /api/activities` · `DELETE /api/activities/{id}` |
| Predict | `POST /api/predict/lead-score` · `POST /api/predict/revenue-forecast` · `GET /api/predict/{pipeline-insights,anomalies,churn-risk,next-best-actions}` (+ `/{id}` variants) · `POST /api/predict` |
| Analytics | `GET /api/analytics/{exec-summary,funnel,cohorts,trends,revenue-history}` · `POST /api/analytics/forecast-scenario` |
| Alerts / Notifications | list, `unread-count`, `read-all`, `/{id}/read`; `POST /api/alerts/regenerate` |
| Copilot | `POST /api/copilot/ask` → `{answer, provider, model, note?, context}` (`provider` is `omniroute` or `local-rules`) |
| Admin (admin only) | `GET/POST /api/users` · `PUT/DELETE /api/users/{id}` · `GET /api/admin/{stats,activity,models}` · `POST /api/admin/models/{name}/retrain` |
| Realtime | `GET /api/events/stream` (SSE) |

## 10. Testing & verification

```powershell
cd backend;  python -m pytest test_api.py -q         # backend (17 tests)
cd frontend; npx tsc --noEmit                        # types
cd frontend; npm run build                           # production build
```
End-to-end script `scripts/verify-e2e` is added in T-006.

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `http://localhost:3000` is blank, `/dashboard` works | ⚠ `src/index.css` corrupted → `.animate-*` classes missing while content starts at `opacity-0` | T-001 |
| Dashboard build fails: "`TopBar.tsx` is not a module" | ⚠ `TopBar.tsx` is empty | T-002 |
| `ModuleNotFoundError: No module named 'app'` | uvicorn started from repo root | `cd backend` first |
| `WinError 10048` / old code still served | stale process holds port 8000 | run the port-freeing command in §3; avoid `--reload` |
| `uvicorn` found under `AppData\Roaming\Python` | not using the venv | activate `backend\.venv` |
| Login returns `422` | JSON sent instead of form | send `username`/`password` form fields |
| Login `401` | wrong credentials or stale DB | see §5; check `backend/data/revops.db` is the one in use |
| Browser: CORS / "failed to fetch" | `CORS_ORIGINS` missing your origin, backend down, or wrong `NEXT_PUBLIC_API_URL` | fix `.env`, restart backend, restart `npm run dev` after editing `.env.local` |
| Copilot always says `local-rules` | OmniRoute not running/configured, or ⚠ doubled `/v1` URL bug | T-005; check `provider`/`note` in the response |
| `InconsistentVersionWarning` (sklearn) | wrong scikit-learn version | `pip install scikit-learn==1.9.0` |

## 12. Before making the repo public

- [ ] Remove the credentials block (§5) and any demo passwords from docs
- [ ] `/api/auth/register` cannot create admin/manager (T-004)
- [ ] `.gitignore` covers `.env*`, `*.db`, `*.log`, `.venv/`, `node_modules/`, `.next/`
- [ ] Old `backend/revops.db` (with password hashes) purged from git history (or accept it's already exposed and rotate all passwords)
- [ ] New strong `JWT_SECRET_KEY`; rotate `OMNIROUTE_API_KEY` if it was ever shared
- [ ] Set `ENVIRONMENT=production`, restrict `CORS_ORIGINS`
