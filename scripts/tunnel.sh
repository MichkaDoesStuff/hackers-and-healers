#!/usr/bin/env bash
# Expose localhost:3000 via Cloudflare quick tunnel (HTTP/2 — more reliable than default QUIC).
#
# IMPORTANT: next dev HMR breaks through Cloudflare — buttons won't work (no React hydration).
# start-stack.sh defaults to production; use LOOP_DEV=1 only for local hot-reload (no tunnel).
set -euo pipefail

if curl -sf http://localhost:3000/ 2>/dev/null | grep -qE 'browser_dev_hmr|webpack-hmr'; then
  echo "ERROR: Next.js is running in DEV mode. Client JS will not hydrate through the tunnel."
  echo "Stop the stack and restart without LOOP_DEV:"
  echo "  ./scripts/start-stack.sh"
  exit 1
fi

if ! curl -sf -o /dev/null http://localhost:3000/ 2>/dev/null; then
  echo "ERROR: Nothing listening on :3000. Start the stack first:"
  echo "  ./scripts/start-stack.sh"
  exit 1
fi

echo "Starting tunnel → http://localhost:3000 (production Next.js)"
echo "Use --protocol http2 if the default tunnel shows 530 errors."
exec cloudflared tunnel --protocol http2 --url http://localhost:3000
