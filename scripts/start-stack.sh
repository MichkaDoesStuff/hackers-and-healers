#!/usr/bin/env bash
# Start the full Loop stack: Loop API, CDS Hooks, and Next.js frontend.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/cds-ai-service/.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a && source "$ENV_FILE" && set +a
fi

free_port() {
  local port=$1
  local pids
  pids=$(lsof -ti ":$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "Freeing port $port (pids: $pids) ..."
    kill $pids 2>/dev/null || true
    sleep 1
  fi
}

free_port 8010
free_port 8000
free_port 3000

echo "Starting Loop API on :8010 ..."
if [[ -d "$ROOT/backend/.venv" ]]; then
  (cd "$ROOT/backend" && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8010) &
else
  (cd "$ROOT/backend" && python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8010) &
fi
LOOP_PID=$!

echo "Starting CDS Hooks service on :8000 ..."
(cd "$ROOT/cds-ai-service" && source .venv/bin/activate && set -a && source .env 2>/dev/null || true && set +a && uvicorn main:app --host 0.0.0.0 --port 8000) &
CDS_PID=$!

echo "Starting Next.js frontend on :3000 ..."
(cd "$ROOT/patient-workflow-visualization" && npm run dev -- --port 3000) &
FRONTEND_PID=$!

cleanup() {
  kill "$LOOP_PID" "$CDS_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "Waiting for servers ..."
for i in {1..40}; do
  if curl -s -o /dev/null http://localhost:8010/health \
    && curl -s -o /dev/null http://localhost:8000/ \
    && curl -s -o /dev/null http://localhost:3000/; then
    break
  fi
  sleep 1
done

echo ""
echo "Stack is up:"
echo "  ClinicOS UI:   http://localhost:3000"
echo "  Loop embed:    http://localhost:3000/embed"
echo "  Sandbox shell: http://localhost:3000/sandbox"
echo "  Loop API:      http://localhost:8010/api/clinic"
echo "  CDS discovery: http://localhost:3000/cds-services"
echo ""
echo "LLM: set LLM_PROVIDER=vertex + GOOGLE_CLOUD_PROJECT in cds-ai-service/.env and backend/.env"
echo "Tunnel: cloudflared tunnel --url http://localhost:3000"
echo ""
wait
