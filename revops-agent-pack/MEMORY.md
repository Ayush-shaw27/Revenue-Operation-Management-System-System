# MEMORY.md — Append-only project log

**Rules:** append only (never edit or delete old entries; add a correcting entry instead). One line per entry, newest at the bottom. Tags: `DECISION` · `FIX` · `FINDING` · `CONTEXT` · `GOTCHA`. Record *why*, not a diff. New pattern/library? Log a `DECISION` first.
Entry format: `- [YYYY-MM-DD] TAG — text (evidence/file)`

---

## Baseline context (reconstructed from CHANGELOG + git + logs)

- [2026-09-07] CONTEXT — Seed CSVs created (`accounts, activities, deals, leads`); ~400 leads, 121 deals, 60 accounts.
- [2026-09-12] CONTEXT — v0.2.0: ML forecast page (Ridge/Linear/GradientBoosting), pipeline page with anomaly + next-best-action.
- [2026-09-13] CONTEXT — v0.3.0: Accounts + Analytics pages; branding renamed "Apogee" → "RevOps Pro".
- [2026-09-15] FIX — v1.0.1: backend host default `127.0.0.1`; added `GET /` and `GET /health`; pinned `scikit-learn==1.9.0` (joblib warning); replaced remote CloudFront video with CSS ambient gradient; `images.remotePatterns`; framer-motion pinned `11.11.17`; `.pyc` untracked.
- [2026-09-15] DECISION — OmniRoute credentials read only via `core/config.py` Settings (never hardcoded) so GitHub push can't leak them.
- [2026-09-15] DECISION — Chart.js + Framer Motion instead of Recharts (peer-dependency conflict). Project runs React 18.3.1 / Next 15.2.4.
- [2026-09-15] DECISION — Login stays form-encoded OAuth2 password flow so Swagger *Authorize* works.
- [2026-09-15] DECISION — Preserve existing `backend/data/revops.db`; standardise on one venv `backend/.venv` (duplicate venvs existed: root `.venv`, `backend/venv`, `backend/.venv`).

## Audit 2026-09-21 (end-to-end, reproduced in a clean Linux sandbox, Py 3.12 / Node 22)

- [2026-09-21] FINDING — Backend is healthy: boots, all 59 GET/POST probes return 2xx with a valid token, `pytest` 17/17 pass. The "not working" symptoms come from environment + frontend defects, not core API logic.
- [2026-09-21] FINDING — `localhost:3000` blank cause: `frontend/src/index.css` is corrupted — `@keyframes shimmer {` (line ~144) has no body and swallows every later rule, so `.animate-fade-up/-down/-left/-right/-scale` never apply while `Animate.tsx` renders `opacity-0`. `/dashboard` "works" only because it uses Framer Motion, not `Animate`. Likely cause: agent write truncated mid-file (token exhaustion).
- [2026-09-21] FINDING — `frontend/src/components/layout/TopBar.tsx` and `BackendConnectionBadge.tsx` are 0 bytes (never committed, not recoverable from git). `DashboardLayout` imports `TopBar` → `npm run build` and `tsc` fail. With a stub TopBar the whole app type-checks and builds (14/14 pages).
- [2026-09-21] FINDING — `backend/scripts/create_user.py` is 0 bytes although CHANGELOG 1.0.1 claims it exists. `frontend/.env.local` and `.env.example` are 0 bytes although CHANGELOG claims `NEXT_PUBLIC_API_URL` was set.
- [2026-09-21] GOTCHA — User logs show three real failure modes: (1) `uvicorn app.main:app` run from repo root → `ModuleNotFoundError: No module named 'app'`; (2) `WinError 10048` — port 8000 already held by a stale uvicorn; (3) uvicorn launched from global Python 3.14 user-site instead of `backend/.venv`.
- [2026-09-21] FINDING — SECURITY: `POST /api/auth/register` accepts `role: "admin"` and returns a working admin (reproduced). Docstring says it defaults to sales-executive; code doesn't.
- [2026-09-21] FINDING — OmniRoute client builds `{OMNIROUTE_BASE_URL}/v1/chat/completions`; `.env` base URL already ends in `/v1` → `/v1/v1/…` 404 → copilot silently uses `local-rules`.
- [2026-09-21] FINDING — Forecast `accuracy` is in-sample R² ×100 (shows 100.0); registry accuracy for lead scoring is 0.0; `admin/stats` hardcodes `system_health 99.9`, `api_latency_ms 42.5`, `requests_today 0`, `ml_inferences_today 0`.
- [2026-09-21] FINDING — Data is stale: all closed deals close in 2024; only 15 closed-won; 133 alerts all unread (every deal alerts). Leftover test rows: user `testadmin@revops.pro`, "Test Deal" (tests write to the dev DB).
- [2026-09-21] FINDING — No real RAG (no embeddings/vector store) and no real XAI (no SHAP/permutation importance); churn `top_factors` are rule strings. `CustomCursor`, `CommandPalette` exist but are mounted nowhere. `/api/events/stream` (SSE) has no frontend consumer and is public.
- [2026-09-21] FINDING — Docs drift: README lists `/dashboard/deals` and `/dashboard/notifications` (no such pages); `.gitignore` lacks `*.db`, `*.log`, `.pytest_cache/`, `.kilo/`; old `backend/revops.db` (+ password hashes) is in git history.
- [2026-09-22] DECISION — Fix order: (1) restore files/CSS, (2) env + startup hygiene, (3) security, (4) integration verify, (5) honesty of ML/AI, (6) data, (7) multi-page site + docs. See `CHECKPOINT.md`.
- [2026-09-22] FIX — T-000 baseline hygiene complete: `.gitignore` now covers `*.db`, `*.db-shm`, `*.db-wal`, `*.log`, `.pytest_cache/`, `.kilo/`, `LOOP_LOG.md`, `_verify_routes.txt`; `backend/data/revops.db` backed up to `backend/data/backups/revops-2026-09-22.db`; `backend/.venv` verified to have all required packages from `requirements.txt`.
