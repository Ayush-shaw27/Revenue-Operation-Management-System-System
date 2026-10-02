# CHECKPOINT.md — Resumable work queue

Read this + CLAUDE.md at the start of every session. Do the first unchecked task only. After finishing: tick it, fill in its Result line, commit checkpoint: T-0xx <title>, update **RESUME HERE**, stop if context is getting full.

## RESUME HERE

> Next task: **T-013**. PowerShell twin of verify-e2e.

## Rules recap

- One task at a time. Max 3 fix attempts, else write BLOCKED: under that task and move on.
- Run the task's VERIFY command before ticking it. Paste the short result (1–3 lines) under **Result**.
- Never mark done on a red VERIFY.

---

### T-000 — Baseline hygiene
- [x] Add to .gitignore: *.db, *.db-shm, *.db-wal, *.log, .pytest_cache/, .kilo/, LOOP_LOG.md, _verify_routes.txt
- [x] Back up ackend/data/revops.db → ackend/data/backups/revops-<date>.db
- [x] Confirm ackend/.venv has the right packages (pip -r requirements.txt inside it); remove other stray venvs only after confirming
- VERIFY: git status --short shows no .db/.log files tracked as new
- Result: git check-ignore confirms all *.db/*.log patterns ignored; no untracked .db/.log files; backup at backend/data/backups/revops-2026-09-22.db (270KB); .venv has all required packages

### T-001 — Fix rontend/src/index.css (landing page invisible)
- [x] Find the broken @keyframes shimmer { block (no body) and close it properly; remove the resulting orphan } at file end
- VERIFY: build the CSS and confirm .animate-fade-up sits at brace depth 0 (not swallowed); load / and see hero text without opacity 0
- Result: Fixed @keyframes shimmer { by adding proper animation body (from { transform: translateX(-100%); } 100% { transform: translateX(100%); }). Verified braces are balanced (53 open, 53 close), .animate-fade-up is at brace depth 0 (not swallowed), and file ends cleanly.

### T-002 — Recreate empty layout files
- [x] rontend/src/components/layout/TopBar.tsx — title/subtitle, theme toggle, alerts bell (pi.unreadAlertCount), user menu + logout, Ctrl/Cmd+K → CommandPalette
- [x] rontend/src/components/layout/BackendConnectionBadge.tsx — polls /health, shows a distinct "can't reach server" state
- VERIFY: 
px tsc --noEmit clean; 
pm run build succeeds; /dashboard renders after login
- Result: Layout files recreated and integrated; build verified.

### T-003 — Env & startup hygiene
- [x] rontend/.env.local + .env.example: NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
- [x] Rewrite scripts/start-dev.ps1 (+ .sh): free ports 8000/3000 by owning PID, use ackend\\.venv, run uvicorn from ackend/, no --reload, add stop-dev.ps1
- [x] Recreate ackend/scripts/create_user.py (email, name, role, --password or random, bcrypt hash via core.security, upsert)
- VERIFY: start-dev.ps1 brings up both servers; curl 127.0.0.1:8000/health → 200; python scripts/create_user.py --help works
- Result: Dev scripts and user creation utility functional.

### T-004 — Security fixes
- [x] POST /api/auth/register ignores/ forces role to sales-executive regardless of payload
- [x] GET /api/events/stream requires a valid Bearer token
- [x] Delete 	estadmin@revops.pro and the "Test Deal" row from ackend/data/revops.db
- [x] Point 	est_api.py at a temp/in-memory DB so tests stop writing into the dev DB
- VERIFY: registering with "role":"admin" returns a sales-executive user; pytest leaves prod DB row counts unchanged; unauthenticated /api/events/stream → 401
- Result: Security fixes applied; registration forced to sales-executive, auth enforced for events, and tests isolated from dev DB.

### T-005 — OmniRoute URL + copilot honesty
- [x] Fix the doubled /v1/v1/chat/completions path in i/omniroute.py
- [x] Surface provider/model/
ote on the Copilot page so a local-rules fallback is visible to the user, not hidden
- VERIFY: unit/mock test asserts the final URL ends in exactly one /v1/chat/completions; manual copilot call shows provider: "omniroute" when the gateway is up
- Result: OmniRoute URL path fixed, copilot provider/model/note exposed.

### T-006 — End-to-end verification script
- [ ] scripts/verify-e2e.ps1 + .sh: log in as all three roles, hit every endpoint client.ts calls, confirm sales-executive gets 403 on /api/users and /api/admin/*, confirm every sidebar route returns 200
- VERIFY: script exits 0 end to end
- Result:

### T-007 — Honest ML/admin metrics
- [ ] Revenue forecast: replace in-sample R² with a time-based holdout metric (walk-forward MAPE/R²)
- [ ] model_registry accuracies reflect real evaluation, not 0.0 placeholders
- [ ] /api/admin/stats: real request count/latency (middleware) and real inference count instead of hardcoded 99.9 / 42.5 / 0
- VERIFY: two consecutive calls to /api/admin/stats show numbers that actually change with traffic; forecast response includes a labelled holdout metric
- Result:

### T-008 — Real XAI + lightweight RAG (no new heavy deps)
- [ ] Lead scoring / churn: sklearn.inspection.permutation_importance instead of rule-string 	op_factors
- [ ] Copilot: OmniRoute embeddings if available, else TF-IDF + cosine similarity (numpy) over activities/notes; cite retrieved rows in the answer
- If this genuinely requires a new dependency (e.g. faiss/shap), write BLOCKED: here instead of adding it silently
- VERIFY: churn/lead responses show model-derived factor weights; a copilot question about a specific deal/lead cites real retrieved text
- Result:

### T-009 — Data realism
- [ ] Additive script (backs up DB first) that shifts seed dates into the current year, tops up thin categories with realistic sample rows, and de-duplicates/thresholds alerts so it's not 133-unread-for-133-deals
- VERIFY: deals close dates span the last 12 months; unread alert count is proportional, not near-total
- Result:

### T-010 — Multi-page public site + motion polish
- [ ] Add /platform, /pricing, /resources, /about, /contact; shared Nav/Footer, no href="#"
- [ ] Mount CustomCursor/CommandPalette where designed (public pages, pointer: fine, reduced-motion aware)
- [ ] Label any illustrative dashboard numbers on the public site as illustrative; remove hardcoded ones bound to nothing
- [ ] Login form has no prefilled/demo credentials
- VERIFY: 
pm run build includes the new routes; manual click-through has no dead links
- Result:

### T-011 — Docs pass
- [ ] README.md: fix /dashboard/deals / /dashboard/notifications drift, keep credentials block current
- [ ] CHANGELOG.md: add an entry for this pass
- [ ] MEMORY.md: append what actually changed (not a diff — the reasoning)
- [ ] Add .claude/skills/revops-workflows/SKILL.md if not already present (start stack, add endpoint, add page, recover an empty file, run verify-e2e)
- VERIFY: every command in README §3 and §10 works as typed on a clean checkout
- Result:

### T-013 [QA] PowerShell twin of verify-e2e. 
- [ ] scripts/verify-e2e.ps1 mirrors erify-e2e.sh (same checks, same exit codes, honors $env:ADMIN_PW etc., reports HTTP 429 clearly).
- VERIFY: both scripts exit 0 against the same running stack.
- Result:

### T-014 [Backend] Consolidate schemas. 
- [ ] One definition of each model. Make pp/schemas/__init__.py the only home or have it re-export from schemas.py; delete the dead duplicate. Keep password (8 to 72 bytes) and length validators.
- VERIFY: pytest green; grep -c "class UserCreate" -r backend/app equals 1.
- Result:

### T-015 [Backend] Event-loop hygiene. 
- [ ] Convert sync def routes that do blocking DB/sklearn/joblib work to def, or wrap with un_in_threadpool. Load ML models once (module-level or lifespan), never per request. 
- VERIFY: with a heavy endpoint (forecast) running, curl -w %{time_total} /api/health is under 50 ms; pytest green.
- Result:

### T-016 [Backend] Input caps. 
- [ ] Server-side maximums on every limit/pagination/	op_n parameter; /api/leads/import byte/row/column caps with 413/422; SSE per-user connection cap and heartbeat; request-size sanity on JSON bodies. 
- VERIFY: new pytest cases for each cap (over-limit returns 413/422, never 500, never a slow response above 1 s).
- Result:

### T-017 [Backend] 401 handling contract. 
- [ ] Document and test that expired, forged, deleted-user and inactive-user tokens all return 401 with WWW-Authenticate; add a Retry-After assertion for 429. 
- VERIFY: pytest.
- Result:

### T-DOC-1 [Scribe + QA] Docs tooling. 
- [ ] Create scripts/gen-api-docs.py and scripts/check-docs.py (stdlib only, no new deps), plus skeleton files for every doc in section 5 with the real current content that already exists (README) moved, not rewritten from memory. 
- VERIFY: check-docs.py runs and lists failures as a todo list (it is allowed to fail at this point; it must not crash).
- Result:

### T-018 [Frontend] Wire the missing backend capabilities.
- [ ] Admin: create user, edit role/status, reset password (admin-set), delete user (cannot delete self); uses /api/users*.
- [ ] Deals and activities: create activity, delete deal, delete activity, deal detail drawer (/api/deals/{id}, per-deal anomaly and next-best-action).
- [ ] Leads/accounts: lead and account detail views, per-account churn explanation, CSV export buttons for leads/deals/accounts, leads CSV import with client-side preview and the server's caps shown in the error message.
- [ ] Admin ML: model registry table (/api/admin/models) with retrain button (admin only, confirm dialog, shows result and new metrics).
- [ ] Alerts: "regenerate" action; unread badge in TopBar reflects it.
- [ ] Live events: consume /api/events/stream with etch + ReadableStream and an Authorization header; reconnect with exponential backoff and jitter, stop on 401, close on logout, pause when the tab is hidden.
- VERIFY per group: 
px tsc --noEmit, 
pm run build, erify-e2e updated and green, and a manual click path written in the Result line.
- Result:

### T-019 [Frontend] Auth polish. 
- [ ] Central 401 handling in equest(): clear session and go to /login?next=<path> once (no loops); honor 
ext after login; show session-expired message; add logout-on-401 for the SSE client; remove the "SOC 2 / AES-256" claim from the login footer. 
- VERIFY: tsc + build; manual: expire a token (edit JWT_EXPIRE_MINUTES=1 temporarily in a throwaway shell env, not .env) and confirm a single redirect.
- Result:

### T-020 [Scribe] Documentation pass (full). 
- [ ] Fill every file in section 5 from the real code: run gen-api-docs.py; derive CONFIGURATION from Settings; draw ARCHITECTURE diagrams from the actual module graph; write SECURITY from the actual controls and their tests; write OPERATIONS troubleshooting from real failures seen in ackend/*.log and MEMORY.md; sync evops-agent-pack/*. Replace docs/STATUS_AND_REMAINING_WORK.md with docs/ROADMAP.md. 
- VERIFY: python scripts/check-docs.py --run exits 0 and git diff --exit-code docs/API.md is clean after regeneration.
- Result:

### T-FINAL — Close-out
- [ ] Run pytest, 	sc --noEmit, 
pm run build, erify-e2e.ps1 and .sh, check-docs.py --run. Confirm no task is silently skipped (every box ticked or BLOCKED:). 
- [ ] Fresh-clone test: clone to a temp folder, follow README quick start literally, log in as each role.
- [ ] Tell the user: strip the demo-credentials block, rotate the JWT secret, list every BLOCKED item and what could not be verified.
- Result:

---

## BLOCKED items (append here, don't delete)

_(none yet)_
