#!/usr/bin/env bash
# Expose localhost:3000 via Cloudflare quick tunnel (HTTP/2 — more reliable than default QUIC).
set -euo pipefail
echo "Starting tunnel → http://localhost:3000"
echo "Use --protocol http2 if the default tunnel shows 530 errors."
exec cloudflared tunnel --protocol http2 --url http://localhost:3000
