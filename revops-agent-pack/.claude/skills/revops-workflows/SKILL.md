---
name: revops-workflows
description: Step-by-step procedures for common RevOps Pro tasks — starting the stack, adding an API endpoint, adding a dashboard page, recovering a truncated/empty file, and running the end-to-end verification. Use whenever a task matches one of these shapes instead of improvising a new approach.
version: 1.0.0
applies_to: revops-platform
---

# SKILL: RevOps Pro workflows

Read `CLAUDE.md` first for the rules these procedures assume (session protocol, layering, never-break list).

## 1. Start the stack

```powershell
Get-NetTCPConnection -LocalPort 8000,3000 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
cd backend; .\.venv\Scripts\Activate.ps1; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
# new terminal
cd frontend; npm run dev
```
Verify: `curl http://127.0.0.1:8000/health` → 200; `http://localhost:3000` loads.
Never use `--reload` when verifying a task — it can mask a crash as "still running the old code".

## 2. Add a new API endpoint

1. Define the request/response shape in `backend/app/schemas/__init__.py`.
2. Add the DB access method to `backend/app/services/data_store.py` (never query SQLAlchemy directly from a route).
3. Add the route in the matching `backend/app/api/routes_<domain>.py`. New domain → new router file, register it in `main.py`. Gate with `Depends(get_current_user)` and, if admin-only, `Depends(require_role("admin"))`.
4. Add a test to `backend/test_api.py` covering success, auth-required, and (if relevant) role-required.
5. Add the method to `frontend/src/api/client.ts` and its type to `frontend/src/api/types.ts`. No component calls `fetch` directly.
6. VERIFY: `pytest -q` green; `curl` the new route with and without a token to confirm the auth gate.

## 3. Add a new dashboard page

1. Create `frontend/app/dashboard/<name>/page.tsx`, wrapped in `DashboardLayout`.
2. Fetch data with `useApi(api.<method>)` — loading/empty/error states via `Skeleton` / `EmptyState` / `ErrorState`.
3. Add the route to `Sidebar` (and `CommandPalette` if it should be Cmd/Ctrl+K searchable).
4. Style from `components/ui/*` and CSS variables in `src/index.css` — don't hardcode colors.
5. VERIFY: `npx tsc --noEmit`, `npm run build`, manual check in both themes, keyboard-only navigation works.

## 4. Recover a 0-byte or truncated file (this has happened twice already)

1. Check git history first: `git log --follow -- <path>`; if any past commit has size > 0, restore from there and re-apply only the needed change.
2. If git has nothing (file was never committed), rebuild it from its importer's expectations: grep every place that imports it to learn its expected props/exports, then write the minimal version that satisfies the type-checker, then flesh out behavior.
3. Rebuild in chunks ≤150 lines. After every write: `wc -c <path>` — if it's suspiciously small relative to what you intended, re-open and check, don't assume it's fine.
4. VERIFY: `npx tsc --noEmit` (frontend) or `python -c "import app.<module>"` (backend) succeeds; the specific feature that broke now works end to end, not just "it compiles".

## 5. Run the end-to-end verification

```powershell
cd backend;  python -m pytest test_api.py -q
cd frontend; npx tsc --noEmit
cd frontend; npm run build
.\scripts\verify-e2e.ps1        # once T-006 exists
```
All four must be green before a task is marked done in `CHECKPOINT.md`. A task is not complete because the code "looks right" — only because its VERIFY command passed.

## 6. When something doesn't fit any of the above

Don't invent a new pattern silently. Check `CLAUDE.md §7` (where new code belongs) and `§3` (why things are built this way). If the task would require crossing a boundary in `§4` or breaking a rule in `§6`, stop and follow the escalation rule in `CLAUDE.md §8` / `AGENTS.md` (STOP → name the conflict → smallest fix, or `BLOCKED:` in loop mode).
