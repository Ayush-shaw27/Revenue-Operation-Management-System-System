# RevOps Platform

AI-powered Revenue Operations platform with predictive lead scoring, churn detection, anomaly detection, revenue forecasting, and an intelligent copilot (Grok / xAI) — backed by a FastAPI + SQLite backend and a Next.js 15 frontend.

---

## Table of Contents

- [Demo Accounts](#demo-accounts) ← **start here to log in**
- [Quick Start](#quick-start)
- [Deploy to Railway](#deploy-to-railway)
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
| Web app login        | `http://localhost:3000/login` (or your deployed URL) | the email address     | as above |
| Swagger *Authorize*  | `http://127.0.0.1:8000/docs`                         | the email address     | as above |
| API (curl)           | `POST http://127.0.0.1:8000/api/auth/login`          | `username=` the email | as above |

**Email case does not matter** — `Admin@RevOps.Pro` works the same as
`admin@revops.pro`. Leading/trailing spaces are stripped too.

### Logging in via the browser

1. Open the app (locally `http://localhost:3000`, or your deployed URL).
2. Go to `/login` — the landing page's **Sign in** button takes you there.
3. Type the **email address** in the first box (e.g. `admin@revops.pro`).
4. Type the **password** in the second box (e.g. `adminpass`).
5. Press **Sign in**, or just press `Enter`.
6. You land on `/dashboard`. Admin accounts also get `/dashboard/admin`.

There is **no signup page**. Accounts are created by an admin or from the CLI —
see [Creating accounts](#creating-accounts).

### Logging in from the command line

```bash
# Get a token
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -d "username=admin@revops.pro&password=adminpass"

# Use it
curl http://127.0.0.1:8000/api/leads -H "Authorization: Bearer <access_token>"
```

Or check that the credentials work for your clone without starting the server:

```bash
cd backend
python -c "from app.services import data_store as ds; print(ds.verify_user_password('admin@revops.pro','adminpass'))"
```

`True` means `adminpass` is the working password for the seeded admin. Passwords
are bcrypt-hashed, so the plaintext above appears only in this README and the
seed CSV — never in the database.

**Never stored in this repository:** `JWT_SECRET_KEY` and `XAI_API_KEY`.
Copy `backend/.env.example` to `backend/.env` and set your own values.

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
# In your backend terminal
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

Pass `--prompt` if you'd rather type the password yourself (hidden input)
instead of using the generated one.

A `POST /api/auth/register` endpoint also exists for programmatic signup, but
it is not wired to the UI and always forces the `sales-executive` role —
self-registration can never grant `admin` or `manager`. Set
`ALLOW_REGISTRATION=0` to close it entirely (recommended before sharing a
public URL).

---

## Deploy to Railway

Two services: the FastAPI backend on **Railway**, the Next.js frontend on
**Vercel** (or Railway too). The split matters — the backend is the only thing
that ever sees your AI key.

### 1. Push the code

```bash
git add -A
git commit -m "Railway + Grok deployment"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

### 2. Backend on Railway

1. **New Project → Deploy from GitHub repo**, pick your repo.
2. On the service, set **Root Directory** to `backend`.
   Railway reads [`railway.toml`](backend/../railway.toml) from the repo root
   automatically — it starts uvicorn on `$PORT`, which is all you need.
3. Add these under **Variables**:

   | Variable         | Value                                                            |
   | ---------------- | ---------------------------------------------------------------- |
   | `JWT_SECRET_KEY` | `python -c "import secrets; print(secrets.token_urlsafe(48))"`     |
   | `XAI_API_KEY`    | Your key from <https://console.x.ai>                             |
   | `ENVIRONMENT`    | `production`                                                      |
   | `ALLOW_REGISTRATION` | `0` — see below                                             |

   Railway sets `PORT` itself. Do not set it by hand.

4. **CORS** — set `CORS_ORIGINS` to your frontend URL **once you have it**
   (step 3 below), e.g. `https://your-app.vercel.app`. Only your real
   frontend origin belongs there. With `ENVIRONMENT=production` the app
   refuses to boot on a placeholder `JWT_SECRET_KEY`, so step 3 is mandatory,
   not optional.

5. **Storage — read this.** The app defaults to SQLite, and Railway's
   filesystem is **ephemeral**: every redeploy deletes the database and you
   restart from the seed CSVs. Choose one:

   - **Volume (quickest, fine for a demo).** Service → **Volumes → Add
     Volume**, mount path `/data`. Then set
     `DATABASE_URL=sqlite:////data/revops.db` (four slashes — the first three
     are the scheme, the fourth makes `/data` an absolute path).
   - **Postgres (correct for real use).** Add a PostgreSQL plugin and set
     `DATABASE_URL=postgresql://user:pass@host:5432/railway`. This project has
     **no Alembic migrations yet**, so plan on adding them.

6. Deploy. Railway prints a URL like `https://revops-backend.up.railway.app`.
   Check it with `https://revops-backend.up.railway.app/health` — you should
   see `"status": "healthy"`.

> The first request after a cold start trains the ML models (they are
> git-ignored, so every fresh container starts without artifacts). This takes a
> few seconds; the healthcheck allows 60s for it.

### 3. Frontend on Vercel

1. Import the same repo, set **Root Directory** to `frontend`.
2. Environment variable: `NEXT_PUBLIC_API_URL=https://revops-backend.up.railway.app`
3. Deploy.
4. Copy the Vercel URL back into the backend's `CORS_ORIGINS` and **redeploy
   the backend** — CORS is read at startup.

### 4. Before you share the public link

Do these three things, or the first stranger can cost you money or take over
the app:

| Step                    | Why                                                             |
| ----------------------- | --------------------------------------------------------------- |
| `ALLOW_REGISTRATION=0`  | Otherwise anyone can self-register and spend your Grok balance |
| Change the demo passwords | `adminpass` is printed in this README — it is public         |
| Set a spend cap at x.ai  | A hard ceiling if anything slips through                        |

The demo passwords are deliberately public so a reviewer can log in. That is a
fair trade for a demo, and an unacceptable one for anything real.

### Troubleshooting Railway

| Symptom                                   | Cause / fix                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| Health check fails, service won't start   | `ENVIRONMENT=production` with a placeholder `JWT_SECRET_KEY` — read the deploy logs, it names the variable |
| Frontend loads, every API call fails      | Wrong `NEXT_PUBLIC_API_URL`, or `CORS_ORIGINS` not set to the Vercel URL. Check the browser console for a CORS error |
| Backend returns 401 for valid credentials | Wrong `JWT_SECRET_KEY` — changing it invalidates every issued token; redeploy and log in again |
| Data disappears after each deploy         | No volume/Postgres attached. See step 5                                |
| Copilot always answers `local-rules`      | `XAI_API_KEY` not set. The response `note` field says which, and never pretends |

---

## Architecture

```
revops-platform/
├── backend/          # Python FastAPI backend (127.0.0.1:8000)
│   ├── app/
│   │   ├── api/      # REST route handlers (auth, crm, ml, alerts, admin, ...)
│   │   ├── ai/       # Copilot client (Grok/xAI + offline rule fallback)
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
| Auth     | OAuth2 password flow, JWT (`PyJWT`), bcrypt hashing                      |
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

| AI       | xAI (Grok) over the OpenAI-compatible `/chat/completions` API, with an offline rule-based fallback |
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
| `JWT_SECRET_KEY`     | *(placeholder — startup aborts in prod)*     | JWT signing secret — **set your own** |
| `JWT_EXPIRE_MINUTES` | `480`                                        | Token lifetime in minutes             |
| `XAI_BASE_URL`       | `https://api.x.ai/v1`                        | xAI API base URL                      |
| `XAI_API_KEY`        | *(empty — copilot falls back to rules)*      | AI provider key — **set your own**    |
| `XAI_MODEL`          | `grok-4.7`                                   | AI model name                         |
| `XAI_TIMEOUT_SECONDS`| `30.0`                                       | Provider call timeout                 |
| `CORS_ORIGINS`       | `http://localhost:3000`                      | Comma-separated allowed origins       |
| `ENVIRONMENT`        | `development`                                | `production` enables startup safety checks |
| `ALLOW_REGISTRATION` | `1`                                          | Set `0` to close public signup        |
| `SCHEDULER_ENABLED`  | `0`                                          | Set to `1` to enable APScheduler      |
| `LOGIN_RATE_LIMIT`   | `30`                                         | Login attempts per IP per window      |
| `COPILOT_RATE_LIMIT` | `20`                                         | Copilot questions per IP per minute   |

> `.env` is git-ignored. `.env.example` is committed and contains only
> placeholders — never commit a populated `.env`.

The AI copilot works **without** `XAI_API_KEY` by falling back to a built-in
rule-based responder. Every copilot response declares its `provider`
(`grok` or `local-rules`), `model`, and a `note`, so you can always tell which
engine answered — it never pretends.

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

Expected: **79 passed**.

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

**AI copilot** — a natural-language RevOps assistant. Uses Grok (xAI) when
`XAI_API_KEY` is configured, otherwise a local rule-based engine. Each response
states its `provider`, `model`, and an explanatory `note`.

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

**Login 401 despite the right password** — check, in order:

1. You are hitting the backend you think you are. A stale server on port 8000
   is the usual cause:
   ```powershell
   netstat -ano | findstr :8000
   taskkill /PID <pid> /F
   ```
2. Test the API directly, bypassing the browser:
   ```powershell
   Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/auth/login" -Method POST -Body @{username="admin@revops.pro";password="adminpass"} -UseBasicParsing
   ```
   A `200` means the backend is fine and the problem is the frontend. A
   connection error means it is not running. A `429` means you hit the login
   rate limit — wait 5 minutes.
3. The seed data may be stale. Delete `backend/data/revops.db*` and restart to
   re-seed, or create a known-good account with `python scripts/create_user.py`.
4. The login page now reports the real reason (bad password vs. rate limited
   vs. server error vs. backend unreachable) instead of always saying
   "Incorrect email or password".

**`no such table` on first startup** — already fixed: the revenue forecast model
tolerates a missing database at import time instead of querying `deals` before
`init_db()` runs.

**Copilot says it cannot reach the provider** — expected without
`XAI_API_KEY`; it falls back to the rule engine and says so in the
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
  proper `XAI_API_KEY`, change or delete the seeded demo accounts, and
  terminate TLS in front of the API. Setting `ENVIRONMENT=production` makes
  the app refuse to boot if the JWT secret is still a placeholder.
- **The AI key never reaches the browser.** It is read only in
  `backend/app/ai/provider.py` from the environment, is never logged, and is
  redacted out of any error text. Never put it in a `NEXT_PUBLIC_*` variable —
  those are compiled into the browser bundle.
- **Copilot is rate limited** (20 questions/minute/IP) and questions are
  capped at 2000 characters, so one visitor cannot drain the key quickly.
- **Passwords are bcrypt-hashed** at rest — the plaintext values above appear
  only in this README and the seed CSV, never in the database.
- **Login is rate limited** per IP (30 attempts per 5 minutes). If several
  people share one IP, raise `LOGIN_RATE_LIMIT` or they will lock each other
  out.
- **The SSE stream requires a valid JWT.** Unauthenticated, invalid, expired, or
  inactive-user tokens are rejected.
- **`.env`, `.db`, `.venv`, and `.joblib` files are git-ignored.** Only
  `.env.example` templates are committed. Model artifacts retrain themselves
  on first use.
- **Self-registration cannot escalate privileges.** Requesting `admin` or
  `manager` at `/api/auth/register` is silently downgraded to
  `sales-executive`.

---

## License

Provided for evaluation and educational use. Seeded company names come from a
public S&P 500 constituents compilation
(<https://github.com/datasets/s-and-p-500-companies>) plus a small curated list
of fictional companies.


