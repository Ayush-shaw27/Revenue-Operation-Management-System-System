# AGENTS.md — Roles, Boundaries, Loop Rules

One Cline agent plays several "hats". Each hat has a scope. Switch hats by task, never mix scopes in one commit.
Read `CLAUDE.md` for architecture intent and `CHECKPOINT.md` for the work queue.

## Hats

| Hat | May edit | Must NOT edit | Done when |
|---|---|---|---|
| **Backend** | `backend/app/**`, `backend/scripts/**`, `backend/test_api.py`, `backend/requirements.txt` | `frontend/**`, `backend/data/revops.db` (except via app/scripts), `.env` values | `pytest` green + the task's `curl` check returns expected status |
| **Frontend** | `frontend/app/**`, `frontend/src/**`, `frontend/*.config.*`, `frontend/.env.example` | `backend/**`, secrets | `npx tsc --noEmit` + `npm run build` green + route returns 200 with visible content |
| **ML/AI** | `backend/app/ml/**`, `backend/app/ai/**` | UI code, DB schema without ticket | metrics are held-out (not in-sample), endpoint contract unchanged |
| **QA** | tests, `scripts/verify-*.{ps1,sh}` | production code (report only, file a task) | a repeatable script proves the flow end-to-end |
| **Scribe** | `*.md` in repo root, `CHANGELOG.md`, `MEMORY.md`, `CHECKPOINT.md` | code | docs match the code (routes, env vars, ports, commands) |

## Operational boundaries

**Allowed without asking:** read any file (with ranges), run tests/build/typecheck, `curl` localhost, start/stop *our* dev servers on ports 8000/3000, create files in the allowed scopes, `git add/commit` on the working branch.

**Ask first (or write `BLOCKED:` in loop mode):** delete or reset `revops.db`; add a dependency outside the approved stack; rename/move top-level folders; change auth or role model; `git push`; anything touching `.env` values.

**Never:**
- `git push --force`, `git reset --hard` on uncommitted work, `rm -rf` outside `.next/`, `__pycache__/`, `node_modules/`.
- Kill every `node`/`python` process (`taskkill /IM node.exe`) — kill only the PID that owns port 3000/8000.
- `pip install` outside `backend/.venv`; create another venv.
- Echo `.env`, API keys, JWT secrets, or password hashes into chat, logs, docs, or commits.
- Mark a task done without running its verify command and pasting the (short) result into `CHECKPOINT.md`.

## Port hygiene (Windows) — do this before every server start

```powershell
# find owner of a port, then kill just that PID
Get-NetTCPConnection -LocalPort 8000,3000 -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalPort,OwningProcess
Stop-Process -Id <PID> -Force
```
Stale servers holding `:8000` (WinError 10048) and `--reload` orphans are the #1 cause of "the backend isn't working". Never use `--reload` in verification runs.

## Loop protocol

```
LOOP per task:
  1. INSPECT  – grep/sed only what the task needs
  2. FIX      – smallest change; ≤150 lines per write; wc -c after
  3. VERIFY   – run the task's command (pytest / tsc / build / curl)
  4. If red → read the error tail (≤30 lines) → fix → VERIFY   (max 3 attempts)
  5. If green → tick CHECKPOINT.md → git commit "checkpoint: T-0xx" → next task
  6. If 3 fails → BLOCKED note → next task
END when every box is ticked or BLOCKED, then run the final E2E script and update README/CHANGELOG/MEMORY.
```

## Output hygiene (saves tokens)

- Reply to the user in ≤10 lines per task: `T-0xx ✔/✖ — what changed — verify result`.
- No re-explaining the plan, no re-listing files you already listed.
- Prefer `str_replace` edits over rewriting whole files.
- Don't re-read a file you just wrote; trust `wc -c` + the verify command.

## Commit protocol

`checkpoint: T-0xx <imperative title>` — one task per commit, so any task can be reverted alone. First commit of the loop is the baseline (T-000).

## Escalation

Conflict with `CLAUDE.md §6` (never-break list) → STOP → name the conflict → show what it affects → smallest fix. In loop mode record it as `BLOCKED:` and continue.
