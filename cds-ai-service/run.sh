#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ ! -d .venv ]]; then
  echo "Creating Python virtual environment in cds-ai-service/.venv ..."
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q -r requirements.txt

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example (add OPENAI_API_KEY later if you want AI summaries)."
fi

echo "Starting CDS backend on http://localhost:8000"
exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload
