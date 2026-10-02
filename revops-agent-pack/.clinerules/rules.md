# .clinerules — RevOps Pro

Cline-specific rules. Architecture intent, roles, and the task queue live in `CLAUDE.md`, `AGENTS.md`, and `CHECKPOINT.md` — read those first, every session.

## Session start (do this before touching anything)

1. Read `CLAUDE.md` and `CHECKPOINT.md`. Skim `MEMORY.md`'s newest entries only.
2. Work the first unchecked task in `CHECKPOINT.md`. One task per loop iteration.
3. If auto-approve is on and nobody is watching: never wait for input. On a blocker, write `BLOCKED:` in `CHECKPOINT.md` and move to the next task instead of pausing.

## Tool-use discipline (token budget)

- Prefer targeted reads: line-ranged file views, `grep -n`, `tail -n 30` on logs — never dump a whole large file or a full log.
- Prefer surgical edits (search/replace) over rewriting a whole file when only part of it changes.
- After writing a file, check its size instead of re-reading its full content back.
- Don't restate the plan or already-known context before each action — act, then report the result in a few lines.
- Batch related shell steps into one command instead of many round trips (e.g. `cmd1 && cmd2`).

## Commands this project uses often

```powershell
cd backend;  .\.venv\Scripts\Activate.ps1; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
cd frontend; npm run dev
cd backend;  python -m pytest test_api.py -q
cd frontend; npx tsc --noEmit
cd frontend; npm run build
```

## Never do, even with auto-approve

- Print `.env` contents, JWT secrets, API keys, or password hashes into chat or logs.
- `git push` (local commits only, per `checkpoint: T-0xx` convention in `AGENTS.md`).
- Reset or delete `backend/data/revops.db` without a backup in `backend/data/backups/` first.
- Add a new dependency, framework, or architectural pattern without logging a `DECISION` in `MEMORY.md` first (or a `BLOCKED:` note if you can't get confirmation).
- Kill all `node`/`python` processes — only the PID actually holding port 3000/8000.

## Checkpointing

After each finished task: tick it in `CHECKPOINT.md`, add a one-line **Result**, update **RESUME HERE**, then `git commit -m "checkpoint: T-0xx <title>"`. If context usage is getting high (roughly after 5 tasks), stop cleanly at a commit boundary rather than mid-task — the next session resumes from `CHECKPOINT.md`, not from chat history.
