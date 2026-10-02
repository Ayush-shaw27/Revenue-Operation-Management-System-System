# CLAUDE.md — RevOps Pro

> Read this file first, then `CHECKPOINT.md`. Code shows *what*; this file records *why* and *where*.
> Deep detail: `ARCHITECTURE.md` · UI rules: `DESIGN.md` · history: `MEMORY.md` · roles: `AGENTS.md` · procedures: `.claude/skills/revops-workflows/SKILL.md`

**Stack** — Backend: FastAPI + SQLAlchemy + SQLite (`:8000`). Frontend: Next.js 15 App Router + React 18.3 + Tailwind 3 + Framer Motion + Chart.js (`:3000`). ML: scikit-learn (joblib artifacts). LLM: OmniRoute gateway (server-side only).

---

## 0. SESSION PROTOCOL (token discipline — follow every session)

1. Read only `CLAUDE.md` + `CHECKPOINT.md` at start. Open other docs only when the task needs them.
2. Pick the first unchecked task in `CHECKPOINT.md`. Do **one** task at a time.
3. Read code with `grep -n` / `sed -n 'A,Bp'` ranges. Never `cat` a file >150 lines. Never dump logs — use `tail -n 30`.
4. Never print `.env`, tokens, or API keys. Refer to variables by name only.
5. Write files in chunks of ≤150 lines. After **every** write run `wc -c <file>`; a 0-byte or truncated file is a failure — rewrite it immediately (this is how `TopBar.tsx` and `index.css` were lost before).
6. After every task: run the task's verify command → tick the box in `CHECKPOINT.md` → `git add -A && git commit -m "checkpoint: T-0xx <title>"`.
7. If context feels >60% used, or after 5 finished tasks: update `CHECKPOINT.md` "RESUME HERE", commit, and start a fresh session.
8. Max 3 fix attempts per problem. Then write `BLOCKED: <reason + evidence>` in `CHECKPOINT.md` and move to the next task.

---

## 1. WHAT'S IN THE SYSTEM?

```
Browser ─► Next.js pages ─► components ─► hooks/useApi ─► src/api/client.ts ──HTTP+Bearer──►
   FastAPI routers (backend/app/api) ─► services/data_store.py ─► SQLAlchemy ─► SQLite (backend/data/revops.db)
                                     ├─► ml/ (inference + joblib artifacts)
                                     ├─► ai/omniroute.py ─► OmniRoute gateway (:20128)
                                     └─► workers/ (APScheduler jobs, SSE EventBus)
```

## 2. WHO'S RESPONSIBLE FOR WHAT? (one owner each)

| Responsibility | Sole owner |
|---|---|
| Identity, JWT, RBAC | `backend/app/core/security.py`, `api/routes_auth.py` · frontend `contexts/AuthContext.tsx` |
| Config & secrets | `backend/app/core/config.py` (Settings) — nothing else reads env |
| Persistence / CRUD | `backend/app/services/data_store.py` over models in `database/connection.py` |
| KPI aggregation | `services/exec_summary.py` + `api/routes_analytics.py` |
| Alerts | `services/alert_engine.py` |
| ML models / training | `ml/artifacts/*` (class + `.joblib`), `ml/training/retrain.py`; inference in `ml/inference/*` |
| LLM calls | `ai/omniroute.py`; copilot orchestration `ai/copilot.py` |
| Frontend HTTP | `frontend/src/api/client.ts` only; types in `src/api/types.ts` |
| Theme tokens | `frontend/src/index.css` + `contexts/ThemeContext.tsx` |
| App chrome | `components/layout/{DashboardLayout,Sidebar,TopBar,CommandPalette}.tsx` |

## 3. WHY IS IT BUILT THIS WAY? (do not "improve" these)

- **SQLite, single file** — zero-setup demo/internship project. `backend/data/revops.db` is precious: preserve it, never reset or duplicate. Seeding only runs when tables are empty.
- **bcrypt used directly** (not passlib) — passlib breaks on bcrypt ≥4.
- **Login is form-encoded OAuth2** (`username`, `password`) so Swagger's *Authorize* works. Don't switch to JSON.
- **OmniRoute server-side only** — key never reaches the browser. Copilot has a *labelled* `local-rules` fallback (`provider` field). Keep it honest; never fake AI output.
- **Chart.js, not Recharts** — Recharts caused a peer-dependency conflict. Don't add it.
- **framer-motion pinned 11.11.17**, React 18.3.1, Next 15.2.4 — known-good combo.
- **`frontend/app` (routes) + `frontend/src` (code), alias `@/* → ./src/*`** — don't move.
- **Bind 127.0.0.1 and set `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`** — avoids Windows `localhost`→`::1` mismatches.
- **scikit-learn pinned 1.9.0** — matches the shipped `.joblib` artifacts.
- **One venv: `backend/.venv`.** Run uvicorn from `backend/` (imports are `app.*`).
- **Light theme is its own token set**, not an inverted dark theme. Both must look finished.
- **Must look like a real production product** — no prefilled/demo credentials in the UI, no hardcoded KPIs.

## 4. WHAT'S ALLOWED TO TOUCH WHAT?

```
Frontend:  app/**/page.tsx → components/* → hooks/useApi → api/client.ts → HTTP
Backend:   api/* → services/* → database/*        api/* → ml/*, ai/*        ml/* → (reads via services only)
```

**Explicitly banned**
- UI must never call `fetch`/`axios` directly or touch the token in `localStorage` (only `client.ts` / `AuthContext`).
- The browser must never call OmniRoute or hold its key.
- `api/*` must never import `database.connection` or write SQL — go through `data_store`.
- `ml/*` must never write to the DB (registry writes go through `data_store.register_model`).
- Nothing except `core/config.py` reads `os.environ` / `.env`.
- No secrets in source, logs, README, or git.
- No second copy of any logic (KPIs live in `exec_summary` only).

## 5. HOW DOES DATA ACTUALLY MOVE?

- **Login:** `LoginForm → AuthContext.login → api.login (POST /api/auth/login, form) → verify_password → JWT → localStorage → /dashboard`
- **Read:** `page → useApi(api.x) → client.request (Bearer) → route (Depends auth) → data_store/ml → JSON → state → chart/table`
- **Write:** `modal → api.createLead → POST → data_store.create_lead → commit → audit + event → alert_engine → page load() refresh`
- **Copilot:** `page → POST /api/copilot/ask → live metrics (exec_summary) → OmniRoute chat → {answer, provider, model}`; on failure → `local-rules` + `note`
- **Forecast:** `POST /api/predict/revenue-forecast → RevenueForecastModel (monthly closed-won history) → series + metrics`

## 6. WHAT CAN NEVER BREAK?

- Secrets stay server-side; `.env` / `.env.local` are git-ignored and never printed.
- `backend/data/revops.db` survives every change (back up to `backend/data/backups/` before schema edits; additive changes only).
- Public `/api/auth/register` must **never** be able to create `admin` or `manager`.
- Every number on screen comes from the API. No hardcoded accuracy, revenue, or "AI insight" text.
- `npx tsc --noEmit`, `npm run build`, and `pytest` are green before any task is marked done. Tests never write to the dev DB.
- No 0-byte or truncated files (`wc -c` after every write).
- One home per piece of logic. No new pattern/library without a reason recorded in `MEMORY.md`.

## 7. WHERE DOES NEW CODE BELONG?

| Adding… | Put it in |
|---|---|
| API endpoint | schema in `schemas/`, handler in the matching `api/routes_<domain>.py` (new router only for a new domain, registered in `main.py`), DB via `data_store`, test in `test_api.py`, method in `client.ts` + type in `types.ts` |
| DB column/table | model in `database/connection.py`, additive only, update seed CSVs, backup DB first |
| ML model | class in `ml/artifacts/`, wrapper in `ml/inference/`, `register_model`, retrain in `ml/training/retrain.py`, endpoint in `routes_ml.py` |
| Dashboard page | `frontend/app/dashboard/<name>/page.tsx` wrapped in `DashboardLayout`, data via `useApi`; add to `Sidebar` **and** `CommandPalette` |
| UI primitive / chart | `components/ui/` / `components/charts/` (Chart.js) |
| LLM feature | `ai/` via `OmniRouteClient` |
| Env var | `core/config.py` + `.env.example` + README table |
| Background job | `workers/jobs.py` + register in `workers/scheduler.py` |

## 8. WHEN DOES CLAUDE STOP AND ASK?

If a task means breaking a rule above:
**STOP → name the conflict → show what it affects → propose the smallest fix that doesn't break it.**

Stop triggers: deleting/resetting `revops.db` · adding Postgres/Redux/Recharts/another framework · touching secrets · renaming top-level dirs · changing the auth flow or role model · adding a second way to fetch/auth/query · any fix that requires crossing a banned boundary.

**Loop mode (Cline auto-approve, nobody watching):** don't wait. Write `BLOCKED:` with the conflict + smallest fix in `CHECKPOINT.md`, skip to the next task.
