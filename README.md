# RevOps Platform

AI-powered Revenue Operations platform with predictive lead scoring, churn detection, anomaly detection, revenue forecasting, and an intelligent copilot — backed by a FastAPI + SQLite backend and a Next.js 15 frontend.

---

## Table of Contents

- [Demo Accounts](#demo-accounts)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [API Endpoints](#api-endpoints)
- [Frontend Routes](#frontend-routes)
- [Environment Configuration](#environment-configuration)
- [Running Tests](#running-tests)
- [Features](#features)
- [Troubleshooting](#troubleshooting)
- [Security Notes](#security-notes)

---

## Demo Accounts

> **These are public demo credentials.** They exist so anyone cloning this
> repository can log in and evaluate the project. Do **not** reuse them on a
> real deployment — see [Security Notes](#security-notes).

These accounts are seeded automatically the first time the backend starts (from
`backend/data/users.csv`), so a fresh clone is immediately usable.

| Role           | Email                | Password      | Can access                           |
| -------------- | -------------------- | ------------- | ------------------------------------ |
| **Admin**      | `admin@revops.pro`   | `adminpass`   | Everything, incl. `/dashboard/admin` |
| **Manager**    | `manager@revops.pro` | `managerpass` | Dashboards, reports, no Admin page   |
| **Sales Exec** | `rep@revops.pro`     | `reppass`     | Leads, deals, pipeline               |

**Where to use them**

| Surface              | Where                                                | Username field        | Password |
| -------------------- | ---------------------------------------------------- | --------------------- | -------- |
| Web app login        | <http://localhost:3000/login>                        | the email address     | as above |
| Swagger *Authorize*  | <http://127.0.0.1:8000/docs>                         | the email address     | as above |
| API (curl)           | `POST http://127.0.0.1:8000/api/auth/login`          | `username=` the email | as above |

**Never stored in this repository:** `JWT_SECRET_KEY` and `OMNIROUTE_API_KEY`.
Copy `backend/.env.example` to `backend/.env` and set your own values.

### Verifying the credentials yourself

Passwords are bcrypt-hashed, so you can confirm the table above is correct for
your clone at any time:

```bash
cd backend
python -c "from app.services import data_store as ds; print(ds.verify_user_password('admin@revops.pro','adminpass'))"
```

`True` means `adminpass` is the working password for the seeded admin.

---

## Quick Start

### Prerequisites

- **Python 3.10+** — <https://www.python.org/downloads/>
- **Node.js 18+** — <https://nodejs.org/>

### Option A — one command (recommended)

From the repository root:

```bash
# Windows (PowerShell)
./scripts/start-dev.ps1

# macOS / Linux (Bash)
./scripts/start-dev.sh
```

These start the backend on `127.0.0.1:8000` and the frontend on
`127.0.0.1:3000`, wait for the API health check to pass before reporting
success, record both PIDs, and print the login URL. Stop both with
`stop-dev.ps1` / `stop-dev.sh`.

### Option B — run each side manually

**Backend**

```bash
cd backend

# Activate the virtual environment
source .venv/bin/activate          # macOS / Linux
# .venv\Scripts\activate           # Windows PowerShell

pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Then open <http://localhost:3000> and log in with a demo account.

> **Use `127.0.0.1`, not `localhost`.** On Windows `localhost` can resolve to
> IPv6 `::1`, which the backend does not bind, producing a confusing
> `ERR_CONNECTION_REFUSED`. The shipped `frontend/.env.example` already uses
> `http://127.0.0.1:8000`.

### Database

The SQLite database is **auto-created and seeded on first startup** — no manual
step required. To start completely fresh, stop the server and delete
`backend/data/revops.db*`, then restart.

### Creating accounts

The `/login` page is sign-in only. New accounts are created with the CLI:

```bash
cd backend

# Interactive: prompts for a hidden password
python scripts/create_user.py --email you@revops.pro --name "Your Name" --role admin

# Or omit --password to generate a strong random one and print it once
python scripts/create_user.py --email you@revops.pro --name "Your Name" --role admin
```

Valid roles: `admin`, `manager`, `sales-executive`.
There is no password-reset flow, so copy a generated password immediately.

A `POST /api/auth/register` endpoint also exists for programmatic signup, but
it is not wired to the UI and always forces the `sales-executive` role —
self-registration can never grant `admin` or `manager`.

---

## Architecture

```
revops-platform/
├── backend/          # Python FastAPI backend (127.0.0.1:8000)
│   ├── app/
│   │   ├── api/      # REST route handlers (auth, crm, ml, alerts, admin, ...)
│   │   ├── ai/       # Copilot client (OmniRoute + offline rule fallback)
│   │   ├── core/     # Config, security (JWT + bcrypt)
│   │   ├── database/ # SQLAlchemy models & connection
│   │   ├── ml/       # ML models (lead scoring, churn, anomaly, forecast)
│   │   ├── schemas/  # Pydantic request/response models
│   │   ├── services/ # Data store, alert engine, exec summary, metrics
│   │   └── workers/  # Background scheduler & jobs
│   ├── data/         # SQLite DB + CSV seed files
│   ├── scripts/      # Seed loader, data seeding, create_user CLI
│   └── .venv/        # Python virtual environment
├── frontend/         # Next.js 15 + React 18 + Tailwind CSS (127.0.0.1:3000)
│   ├── app/          # Next.js App Router (layout.tsx + page.tsx)
│   └── src/
│       ├── api/        # Typed API client + shared types
│       ├── components/ # Nav, Hero, layout, charts, UI primitives
│       ├── contexts/   # Auth + theme providers
│       ├── hooks/      # Data-fetching hooks
│       └── lib/        # Formatting + motion utilities
├── scripts/          # start-dev / stop-dev (PowerShell + Bash)
└── README.md
```

### Tech stack

| Layer    | Technology                                                                   |
| -------- | ---------------------------------------------------------------------------- |
| Backend  | Python 3.10+, FastAPI, Uvicorn, SQLAlchemy 2, SQLite                          |
| Auth     | OAuth2 password flow, JWT (`python-jose`), bcrypt hashing                    |
| ML       | scikit-learn (RandomForest, GradientBoosting, IsolationForest, Ridge/Linear) |
## API Endpoints

Interactive docs: <http://127.0.0.1:8000/docs>

### Authentication

| Method | Path                | Description                  | Auth   |
| ------ | ------------------- | ---------------------------- | ------ |
| POST   | `/api/auth/login`   | Login (OAuth2 password form) | Public |
| POST   | `/api/auth/register`| Register (always exec role)  | Public |
| GET    | `/api/auth/me`      | Current user profile         | Bearer |

### Health

| Method | Path           | Description                  | Auth   |
| ------ | -------------- | ---------------------------- | ------ |
| GET    | `/api/health`  | Health check (+ model state) | Public |
| GET    | `/health`      | Health check alias           | Public |

### CRM

| Method | Path                        | Description       | Auth   |
| ------ | --------------------------- | ----------------- | ------ |
| GET    | `/api/leads`                | List leads        | Bearer |
| POST   | `/api/leads`                | Create a lead     | Bearer |
| GET    | `/api/leads/{lead_id}`      | Get one lead      | Bearer |
| PUT    | `/api/leads/{lead_id}`      | Update a lead     | Bearer |
| DELETE | `/api/leads/{lead_id}`      | Delete a lead     | Bearer |
| GET    | `/api/leads/export`         | Export leads CSV  | Bearer |
| POST   | `/api/leads/import`         | Import leads CSV  | Bearer |
| GET    | `/api/deals`                | List deals        | Bearer |
| POST   | `/api/deals`                | Create a deal     | Bearer |
| GET    | `/api/deals/{deal_id}`      | Get one deal      | Bearer |
| PUT    | `/api/deals/{deal_id}`      | Update a deal     | Bearer |
| DELETE | `/api/deals/{deal_id}`      | Delete a deal     | Bearer |
| GET    | `/api/deals/export`         | Export deals CSV  | Bearer |
| GET    | `/api/accounts`             | List accounts     | Bearer |
| GET    | `/api/accounts/{account_id}`| Get one account   | Bearer |
| GET    | `/api/accounts/export`      | Export accounts   | Bearer |
| GET    | `/api/activities`           | Activity feed     | Bearer |
| POST   | `/api/activities`           | Create activity   | Bearer |
| DELETE | `/api/activities/{activity_id}` | Delete activity | Bearer |

### Machine learning

| Method | Path                                        | Description              | Auth   |
| ------ | ------------------------------------------- | ------------------------ | ------ |

### Alerts & notifications

| Method | Path                                        | Description             | Auth   |
| ------ | ------------------------------------------- | ----------------------- | ------ |
| GET    | `/api/alerts`                               | List alerts             | Bearer |
| GET    | `/api/alerts/unread-count`                  | Unread alert count      | Bearer |
| POST   | `/api/alerts/{alert_id}/read`               | Mark one alert read     | Bearer |
| POST   | `/api/alerts/read-all`                      | Mark all alerts read    | Bearer |
| POST   | `/api/alerts/regenerate`                    | Re-run alert detection  | Bearer |
| GET    | `/api/notifications`                        | List notifications      | Bearer |
| GET    | `/api/notifications/unread-count`           | Unread count            | Bearer |
| POST   | `/api/notifications/{notification_id}/read` | Mark one read           | Bearer |
| POST   | `/api/notifications/read-all`               | Mark all read           | Bearer |

### Analytics & AI

| Method | Path                                 | Description         | Auth   |
| ------ | ------------------------------------ | ------------------- | ------ |
| POST   | `/api/copilot/ask`                   | AI copilot          | Bearer |
| GET    | `/api/analytics/exec-summary`        | Executive summary   | Bearer |
| GET    | `/api/analytics/trends`              | Revenue trends      | Bearer |
| GET    | `/api/analytics/revenue-history`     | Revenue history     | Bearer |
| GET    | `/api/analytics/funnel`              | Conversion funnel   | Bearer |
| GET    | `/api/analytics/cohorts`             | Cohort analysis     | Bearer |
| POST   | `/api/analytics/forecast-scenario`   | Scenario simulation | Bearer |

### Admin (admin role required)

| Method | Path                                  | Description         |
| ------ | ------------------------------------- | ------------------- |
| GET    | `/api/admin/stats`                    | Operational metrics |
| GET    | `/api/admin/activity`                 | Admin activity log  |
| GET    | `/api/admin/models`                   | Model registry      |
| POST   | `/api/admin/models/{model_name}/retrain` | Retrain a model    |
| GET    | `/api/users`                          | List users          |
| POST   | `/api/users`                          | Create a user       |
| PUT    | `/api/users/{user_id}`                | Update a user       |
| DELETE | `/api/users/{user_id}`                | Delete a user       |

### Realtime

| Method | Path                | Description               | Auth   |
| ------ | ------------------- | ------------------------- | ------ |
| GET    | `/api/events/stream` | Authenticated SSE stream  | Bearer |

### Login example

```bash
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -d "username=admin@revops.pro&password=adminpass"
```

The response contains an `access_token`. Use it as a Bearer token:

```bash
curl http://127.0.0.1:8000/api/leads -H "Authorization: Bearer <access_token>"
```

---

## Frontend Routes

| Route                  | Page           | Description                                  |
| ---------------------- | -------------- | -------------------------------------------- |
| `/`                    | Landing        | Marketing page with CTA                      |
| `/login`               | Login          | Sign in (email + password)                  |
| `/dashboard`           | Dashboard Home | KPI cards + revenue trend chart              |
| `/dashboard/leads`     | Leads          | Lead list with AI scoring, search, filters   |
| `/dashboard/accounts`  | Accounts       | Accounts with health bars + CSV export       |
| `/dashboard/pipeline`  | Pipeline       | Deal pipeline with anomaly detection + NBA   |
| `/dashboard/forecast`  | Forecast       | ML revenue forecast with model selector      |
| `/dashboard/analytics` | Analytics      | Revenue trends, funnel, cohorts, scenarios   |
| `/dashboard/copilot`   | AI Copilot     | Natural-language RevOps assistant            |
| `/dashboard/alerts`    | Alerts         | System alerts with read/unread               |
| `/dashboard/admin`     | Admin          | System metrics + model registry (admin only) |

Deals are managed from `/dashboard/pipeline` — there is no separate
`/dashboard/deals` page.

| POST   | `/api/predict/lead-score`                   | Score a lead             | Bearer |
| POST   | `/api/predict/revenue-forecast`             | Revenue forecast         | Bearer |
| POST   | `/api/predict`                              | Generic predict dispatch | Bearer |
| GET    | `/api/predict/pipeline-insights`            | Pipeline diagnostics     | Bearer |
| GET    | `/api/predict/anomalies`                    | Anomalies (all deals)    | Bearer |
| GET    | `/api/predict/anomalies/{deal_id}`          | Anomaly (one deal)       | Bearer |
| GET    | `/api/predict/churn-risk`                   | Churn (all accounts)     | Bearer |
| GET    | `/api/predict/churn-risk/{account_id}`      | Churn (one account)      | Bearer |
| GET    | `/api/predict/next-best-actions`            | NBAs (all deals)         | Bearer |
| GET    | `/api/predict/next-best-actions/{deal_id}`  | NBA (one deal)           | Bearer |

| AI       | OmniRoute-compatible OpenAI client, with an offline rule-based fallback      |
| Frontend | Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS                  |
| Charts   | Chart.js via `react-chartjs-2`                                               |
| Motion   | Framer Motion                                                                |
| Icons    | Lucide React                                                                 |
| Realtime | Server-Sent Events (`sse-starlette`), JWT-authenticated                      |

---

---

## Environment Configuration

### Backend

Copy `backend/.env.example` to `backend/.env` and customise as needed.

| Variable             | Default                                      | Description                           |
| -------------------- | -------------------------------------------- | ------------------------------------- |
| `DATABASE_URL`       | `sqlite:///./data/revops.db`                 | Database connection string            |
| `JWT_SECRET_KEY`     | `change-this-to-a-secure-random-secret`      | JWT signing secret — **set your own** |
| `JWT_EXPIRE_MINUTES` | `480`                                        | Token lifetime in minutes             |
| `OMNIROUTE_BASE_URL` | `http://localhost:8080`                      | AI provider base URL                  |
| `OMNIROUTE_API_KEY`  | `your-omni-route-api-key`                    | AI provider key — **set your own**    |
| `OMNIROUTE_MODEL`    | `revops-ai-v1`                               | AI model name                         |
| `CORS_ORIGINS`       | `http://localhost:3000,http://localhost:8080` | Comma-separated allowed origins       |
| `ENVIRONMENT`        | `development`                                | `development` enables Uvicorn reload  |
| `SCHEDULER_ENABLED`  | `0`                                          | Set to `1` to enable APScheduler      |

> `.env` is git-ignored. `.env.example` is committed and contains only
> placeholders — never commit a populated `.env`.

The AI copilot works **without** OmniRoute credentials by falling back to a
built-in rule-based responder. Every copilot response declares its `provider`,
`model`, and a `note` so you can always tell which engine answered.

### Frontend

Copy `frontend/.env.example` to `frontend/.env.local` (git-ignored).

| Variable              | Default                 | Description          |
| --------------------- | ----------------------- | -------------------- |
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8000` | Backend API base URL |

`NEXT_PUBLIC_*` values are inlined into the browser bundle at build time, so
this file must contain **only public values**.

---

## Running Tests

The test suite uses a **temporary SQLite database** configured before the app is
imported, so running tests never modifies `backend/data/revops.db`.

```bash
cd backend
python -m pytest test_api.py -v --tb=short
```

Expected: **47 passed**.

Frontend type check and production build:

```bash
cd frontend
npm run typecheck
npm run build
```


---

## Features

**Predictive lead scoring** — a RandomForest classifier scores leads from
company size, industry, value, and engagement, returning a 0-100 score, a
label, and the top contributing factors.

**Churn risk** — a gradient-boosted classifier ranks accounts by likelihood of
churning, with risk tiers (low / medium / high) driving the At-Risk panel and
alerts.

**Anomaly detection** — an IsolationForest flags deals sitting abnormally long
in their stage.

**Revenue forecasting** — Ridge / linear / gradient-boosting regression over
**actual closed-won revenue** from the database. Accuracy comes from
**walk-forward (out-of-sample) validation**: the model is fitted only on months
strictly before the month it predicts, instead of reporting in-sample fit,
which would always look near-perfect. Confidence bands come from the standard
deviation of those out-of-sample residuals. If there is too little history the
API returns an honest "insufficient data" forecast with zero totals rather than
inventing numbers.

**AI copilot** — a natural-language RevOps assistant. Uses OmniRoute when
`OMNIROUTE_API_KEY` is configured, otherwise a local rule-based engine. Each
response states its `provider`, `model`, and an explanatory `note`.

**Next-best-action** — rule-based recommendations for stalled and at-risk deals.

**Role-based access** — `admin`, `manager`, and `sales-executive` roles enforced
server-side on admin and user-management routes. Self-registration is always
downgraded to `sales-executive`, so the public signup form cannot be used to
escalate privileges.

**Live operational metrics** — the admin dashboard shows real request counters,
latency percentiles, and model-inference counts collected at runtime instead of
placeholder numbers. Counters are process-local and reset on restart, and the
response reports when the measurement window started.

---

## Troubleshooting

**`ERR_CONNECTION_REFUSED` in the browser** — the frontend is calling
`localhost` but the backend is bound to `127.0.0.1`. Set
`NEXT_PUBLIC_API_URL=http://127.0.0.1:8000` in `frontend/.env.local` and restart
the dev server.

**Login 401 despite the right password** — the seeded `users.csv` can go stale.
Delete `backend/data/revops.db*` and restart to re-seed, or create a known-good
account with `python scripts/create_user.py`.

**`no such table` on first startup** — already fixed: the revenue forecast model
tolerates a missing database at import time instead of querying `deals` before
`init_db()` runs.

**Copilot says it cannot reach the provider** — expected without
`OMNIROUTE_API_KEY`; it falls back to the rule engine and says so in the
response `note`.

**Admin stats show low request counts or odd latency** — counters live in memory
and reset on restart. Latency comes from real traffic, so a freshly started
server with one request has a one-sample window.

**Full reset**

```bash
./scripts/stop-dev.ps1                    # stop both servers
rm -f backend/data/revops.db*             # drop the database
./scripts/start-dev.ps1                   # re-seed on startup
```

---

## Security Notes

- **Demo passwords are public by design.** `adminpass` / `managerpass` /
  `reppass` live in `backend/data/users.csv` so anyone cloning this repository
  can log in. Anyone holding them has full admin access. Never deploy this
  configuration to a reachable environment.
- **Before any real deployment:** set a unique `JWT_SECRET_KEY`, provide a
  proper `OMNIROUTE_API_KEY`, change or delete the seeded demo accounts, and
  terminate TLS in front of the API.
- **Passwords are bcrypt-hashed** at rest — the plaintext values above appear
  only in this README and the seed CSV, never in the database.
- **The SSE stream requires a valid JWT.** Unauthenticated, invalid, expired, or
  inactive-user tokens are rejected.
- **`.env`, `.db`, and `.venv` files are git-ignored.** Only `.env.example`
  templates are committed.
- **Self-registration cannot escalate privileges.** Requesting `admin` or
  `manager` at `/api/auth/register` is silently downgraded to
  `sales-executive`.

---

## License

Provided for evaluation and educational use. Seeded company names come from a
public S&P 500 constituents compilation
(<https://github.com/datasets/s-and-p-500-companies>) plus a small curated list
of fictional companies.


