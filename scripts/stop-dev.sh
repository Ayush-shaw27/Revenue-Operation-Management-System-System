#!/usr/bin/env bash
# Stops the RevOps Pro development servers started by start-dev.sh
set -u

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PID_FILE="$SCRIPT_DIR/.dev-pids.json"

if [ -f "$PID_FILE" ]; then
    # Extract the PIDs from the JSON file (it is JSON, not shell - do not source it).
    BACKEND=$(grep -o '"backend"[[:space:]]*:[[:space:]]*[0-9]*' "$PID_FILE" | grep -o '[0-9]*$')
    FRONTEND=$(grep -o '"frontend"[[:space:]]*:[[:space:]]*[0-9]*' "$PID_FILE" | grep -o '[0-9]*$')
    for pid in "$BACKEND" "$FRONTEND"; do
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            echo "Stopping PID $pid..."
            kill "$pid" 2>/dev/null || true
        fi
    done
    rm -f "$PID_FILE"
else
    echo "No PID file found - falling back to process lookup."
fi

# Fallback: anything still holding the dev ports.
pkill -f "uvicorn app.main:app" 2>/dev/null && echo "Stopped uvicorn." || true
pkill -f "next dev" 2>/dev/null && echo "Stopped next dev." || true

echo "Dev servers stopped."
