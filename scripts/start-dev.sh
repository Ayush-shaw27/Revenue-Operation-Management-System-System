#!/usr/bin/env bash
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( dirname "$SCRIPT_DIR" )"
PID_FILE="$SCRIPT_DIR/.dev-pids.json"

echo "======================================================="
echo " Starting RevOps Pro Development Suite..."
echo "======================================================="

# Refuse to start if a previous run is still alive (avoid port clashes).
if [ -f "$PID_FILE" ]; then
    if pgrep -f "uvicorn app.main:app" >/dev/null 2>&1 || pgrep -f "next dev" >/dev/null 2>&1; then
        echo "[ERROR] A previous dev session is still running."
        echo "        Run ./scripts/stop-dev.sh first, or delete $PID_FILE"
        exit 1
    fi
    rm -f "$PID_FILE"
fi

VENV_PYTHON="$ROOT_DIR/backend/.venv/bin/python"
if [ ! -f "$VENV_PYTHON" ]; then
    VENV_PYTHON="python3"
fi

# No --reload: the reloader spawns a child process that the trap cannot kill,
# which leaves port 8000 occupied after shutdown.
cd "$ROOT_DIR/backend"
"$VENV_PYTHON" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Wait for the API to answer before starting the frontend.
echo "Waiting for the backend to become healthy..."
for _ in $(seq 1 40); do
    if curl -sf http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
        echo "Backend is healthy."
        break
    fi
    sleep 0.5
done

cd "$ROOT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

printf '{"backend": %s, "frontend": %s}\n' "$BACKEND_PID" "$FRONTEND_PID" > "$PID_FILE"

cleanup() {
    echo ""
    echo "Stopping servers..."
    kill "$BACKEND_PID" 2>/dev/null || true
    kill "$FRONTEND_PID" 2>/dev/null || true
    rm -f "$PID_FILE"
    echo "Done."
}

trap cleanup EXIT INT TERM

echo ""
echo "Backend API:   http://127.0.0.1:8000"
echo "Swagger Docs:  http://127.0.0.1:8000/docs"
echo "Frontend App:  http://localhost:3000"
echo ""
echo "Stop both with ./scripts/stop-dev.sh, or press Ctrl+C."

wait
