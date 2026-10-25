#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
cleanup() {
  kill "${api_pid:-}" "${web_pid:-}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
.venv/bin/uvicorn main:app --app-dir services/api --host 127.0.0.1 --port 8000 &
api_pid=$!
npm run dev -w apps/web &
web_pid=$!
wait -n "$api_pid" "$web_pid"
