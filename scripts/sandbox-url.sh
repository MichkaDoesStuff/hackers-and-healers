#!/usr/bin/env bash
# Print URLs for the embedded CDS Sandbox + Loop side panel experience.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/cds-ai-service/.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

TUNNEL="${LOOP_APP_URL:-http://localhost:3000}"
TUNNEL="${TUNNEL%/}"
FHIR="${FHIR_URL:-https://lohp.ryanbeland.dev/fhir}"
PATIENT="${SANDBOX_PATIENT_ID:-b61008f3-84e2-8e3f-abd9-995a23133d57}"

SANDBOX_SHELL="$TUNNEL/sandbox?patientId=$PATIENT"
DEMO_URL="$TUNNEL/demo?patientId=$PATIENT"
DISCOVERY="$TUNNEL/cds-services"

echo "★ Embedded workaround (real CDS Sandbox + Loop side panel):"
echo "  $SANDBOX_SHELL"
echo ""
echo "How it works:"
echo "  • Left: iframe of sandbox.cds-hooks.org wired to your CDS hook"
echo "  • Right: Loop /embed side panel (always visible)"
echo "  • Card link opens /embed-bridge → postMessage → panel updates (tab closes)"
echo ""
echo "Standalone chart demo (no sandbox UI):"
echo "  $DEMO_URL"
echo ""
echo "CDS discovery endpoint:"
echo "  $DISCOVERY"

if [[ "${1:-}" == "--open" ]]; then
  open "$SANDBOX_SHELL"
fi
