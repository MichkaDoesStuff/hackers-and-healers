#!/usr/bin/env bash
# Expose localhost:3000 via Cloudflare quick tunnel (HTTP/2 — more reliable than default QUIC).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UI="$ROOT/patient-workflow-visualization"

is_dev_server() {
  curl -sf http://localhost:3000/sandbox 2>/dev/null | grep -qE 'browser_dev_hmr|webpack-hmr'
}

ensure_production() {
  if ! curl -sf -o /dev/null http://localhost:3000/ 2>/dev/null; then
    echo "Nothing on :3000 — starting production Next.js ..."
    (cd "$UI" && npm run build && npm run start -- --port 3000) &
    for _ in {1..60}; do
      curl -sf -o /dev/null http://localhost:3000/ && break
      sleep 1
    done
    return
  fi

  if is_dev_server; then
    echo "Dev server detected — switching to production (required for tunnel interactivity) ..."
    lsof -ti :3000 | xargs kill 2>/dev/null || true
    sleep 1
    (cd "$UI" && npm run build && npm run start -- --port 3000) &
    for _ in {1..90}; do
      if curl -sf -o /dev/null http://localhost:3000/ && ! is_dev_server; then
        echo "Production Next.js ready on :3000"
        return
      fi
      sleep 1
    done
    echo "ERROR: Failed to start production Next.js on :3000"
    exit 1
  fi
}

ensure_production

echo "Starting tunnel → http://localhost:3000 (production)"
echo "Use --protocol http2 if the default tunnel shows 530 errors."
exec cloudflared tunnel --protocol http2 --url http://localhost:3000
