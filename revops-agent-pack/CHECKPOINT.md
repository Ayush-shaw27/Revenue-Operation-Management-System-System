# CHECKPOINT.md — Resumable work queue

Read this + `CLAUDE.md` at the start of every session. Do the first unchecked task only. After finishing: tick it, fill in its Result line, commit `checkpoint: T-0xx <title>`, update **RESUME HERE**, stop if context is getting full.

## RESUME HERE

> Next task: **T-001**. Fix `frontend/src/index.css` (landing page invisible).

## Rules recap

- One task at a time. Max 3 fix attempts, else write `BLOCKED:` under that task and move on.
- Run the task's VERIFY command before ticking it. Paste the short result (1–3 lines) under **Result**.
- Never mark done on a red VERIFY.

---

### T-000 — Baseline hygiene
- [x] Add to `.gitignore`: `*.db`, `*.db-shm`, `*.db-wal`, `*.log`, `.pytest_cache/`, `.kilo/`, `LOOP_LOG.md`, `_verify_routes.txt`
- [x] Back up `backend/data/revops.db` → `backend/data/backups/revops-<date>.db`
- [x] Confirm `backend/.venv` has the right packages (`pip -r requirements.txt` inside it); remove other stray venvs only after confirming
- VERIFY: `git status --short` shows no `.db`/`.log` files tracked as new
- Result: git check-ignore confirms all *.db/*.log patterns ignored; no untracked .db/.log files; backup at backend/data/backups/revops-2026-09-22.db (270KB); .venv has all required packages

### T-001 — Fix `frontend/src/index.css` (landing page invisible)
- [ ] Find the broken `@keyframes shimmer {` block (no body) and close it properly; remove the resulting orphan `}` at file end
- VERIFY: build the CSS and confirm `.animate-fade-up` sits at brace depth 0 (not swallowed); load `/` and see hero text without opacity 0
- Result:

### T-002 — Recreate empty layout files
- [ ] `frontend/src/components/layout/TopBar.tsx` — title/subtitle, theme toggle, alerts bell (`api.unreadAlertCount`), user menu + logout, `Ctrl/Cmd+K` → `CommandPalette`
- [ ] `frontend/src/components/layout/BackendConnectionBadge.tsx` — polls `/health`, shows a distinct "can't reach server" state
- VERIFY: `npx tsc --noEmit` clean; `npm run build` succeeds; `/dashboard` renders after login
- Result:

### T-003 — Env & startup hygiene
- [ ] `frontend/.env.local` + `.env.example`: `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`
- [ ] Rewrite `scripts/start-dev.ps1` (+ `.sh`): free ports 8000/3000 by owning PID, use `backend\.venv`, run uvicorn from `backend/`, no `--reload`, add `stop-dev.ps1`
- [ ] Recreate `backend/scripts/create_user.py` (email, name, role, `--password` or random, bcrypt hash via `core.security`, upsert)
- VERIFY: `start-dev.ps1` brings up both servers; `curl 127.0.0.1:8000/health` → 200; `python scripts/create_user.py --help` works
- Result:

### T-004 — Security fixes
- [ ] `POST /api/auth/register` ignores/ forces role to `sales-executive` regardless of payload
- [ ] `GET /api/events/stream` requires a valid Bearer token
- [ ] Delete `testadmin@revops.pro` and the "Test Deal" row from `backend/data/revops.db`
- [ ] Point `test_api.py` at a temp/in-memory DB so tests stop writing into the dev DB
- VERIFY: registering with `"role":"admin"` returns a `sales-executive` user; `pytest` leaves prod DB row counts unchanged; unauthenticated `/api/events/stream` → 401
- Result:

### T-005 — OmniRoute URL + copilot honesty
- [ ] Fix the doubled `/v1/v1/chat/completions` path in `ai/omniroute.py`
- [ ] Surface `provider`/`model`/`note` on the Copilot page so a `local-rules` fallback is visible to the user, not hidden
- VERIFY: unit/mock test asserts the final URL ends in exactly one `/v1/chat/completions`; manual copilot call shows `provider: "omniroute"` when the gateway is up
- Result:

### T-006 — End-to-end verification script
- [ ] `scripts/verify-e2e.ps1` + `.sh`: log in as all three roles, hit every endpoint `client.ts` calls, confirm `sales-executive` gets 403 on `/api/users` and `/api/admin/*`, confirm every sidebar route returns 200
- VERIFY: script exits 0 end to end
- Result:

### T-007 — Honest ML/admin metrics
- [ ] Revenue forecast: replace in-sample R² with a time-based holdout metric (walk-forward MAPE/R²)
- [ ] `model_registry` accuracies reflect real evaluation, not 0.0 placeholders
- [ ] `/api/admin/stats`: real request count/latency (middleware) and real inference count instead of hardcoded 99.9 / 42.5 / 0
- VERIFY: two consecutive calls to `/api/admin/stats` show numbers that actually change with traffic; forecast response includes a labelled holdout metric
- Result:

### T-008 — Real XAI + lightweight RAG (no new heavy deps)
- [ ] Lead scoring / churn: `sklearn.inspection.permutation_importance` instead of rule-string `top_factors`
- [ ] Copilot: OmniRoute embeddings if available, else TF-IDF + cosine similarity (numpy) over activities/notes; cite retrieved rows in the answer
- If this genuinely requires a new dependency (e.g. faiss/shap), write `BLOCKED:` here instead of adding it silently
- VERIFY: churn/lead responses show model-derived factor weights; a copilot question about a specific deal/lead cites real retrieved text
- Result:

### T-009 — Data realism
- [ ] Additive script (backs up DB first) that shifts seed dates into the current year, tops up thin categories with realistic sample rows, and de-duplicates/thresholds alerts so it's not 133-unread-for-133-deals
- VERIFY: `deals` close dates span the last 12 months; unread alert count is proportional, not near-total
- Result:

### T-010 — Multi-page public site + motion polish
- [ ] Add `/platform`, `/pricing`, `/resources`, `/about`, `/contact`; shared `Nav`/`Footer`, no `href="#"`
- [ ] Mount `CustomCursor`/`CommandPalette` where designed (public pages, `pointer: fine`, reduced-motion aware)
- [ ] Label any illustrative dashboard numbers on the public site as illustrative; remove hardcoded ones bound to nothing
- [ ] Login form has no prefilled/demo credentials
- VERIFY: `npm run build` includes the new routes; manual click-through has no dead links
- Result:

### T-011 — Docs pass
- [ ] `README.md`: fix `/dashboard/deals` / `/dashboard/notifications` drift, keep credentials block current
- [ ] `CHANGELOG.md`: add an entry for this pass
- [ ] `MEMORY.md`: append what actually changed (not a diff — the reasoning)
- [ ] Add `.claude/skills/revops-workflows/SKILL.md` if not already present (start stack, add endpoint, add page, recover an empty file, run verify-e2e)
- VERIFY: every command in README §3 and §10 works as typed on a clean checkout
- Result:

### T-FINAL — Close-out
- [ ] Run `pytest`, `tsc --noEmit`, `npm run build`, `verify-e2e` — all green
- [ ] Confirm no task above is silently skipped (every box ticked or `BLOCKED:`)
- [ ] Remind the user (in your reply, not in this file) to strip the README credentials block before any public push
- Result:

---

## BLOCKED items (append here, don't delete)

_(none yet)_
