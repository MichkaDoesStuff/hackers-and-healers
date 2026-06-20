#!/usr/bin/env bash
# Quick CDS Hooks smoke test — local backend or deployed stack.
set -euo pipefail

BASE="${1:-http://localhost:3000}"
BASE="${BASE%/}"
SERVICE="${2:-triage-assistant}"
PATIENT_ID="${3:-b61008f3-84e2-8e3f-abd9-995a23133d57}"

echo "Discovery: $BASE/cds-services"
curl -sf "$BASE/cds-services" | python3 -m json.tool

echo ""
echo "CORS preflight (sandbox origin):"
curl -sf -D - -o /dev/null -X OPTIONS "$BASE/cds-services/$SERVICE" \
  -H "Origin: https://sandbox.cds-hooks.org" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" | grep -i access-control || true

echo ""
echo "Hook: POST $BASE/cds-services/$SERVICE (patient=$PATIENT_ID)"
RESP=$(curl -sf -X POST "$BASE/cds-services/$SERVICE" \
  -H "Content-Type: application/json" \
  -H "Origin: https://sandbox.cds-hooks.org" \
  -d "{\"hook\":\"patient-view\",\"hookInstance\":\"smoke-test\",\"fhirServer\":\"https://lohp.ryanbeland.dev/fhir\",\"context\":{\"patientId\":\"$PATIENT_ID\",\"userId\":\"Practitioner/example\"},\"prefetch\":{}}")
echo "$RESP" | python3 -m json.tool
EMBED=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['cards'][0]['links'][0]['url'])")
echo ""
echo "Embed link: $EMBED"
curl -sf -o /dev/null -w "Embed HTTP: %{http_code}\n" "$EMBED" || echo "Embed check skipped (tunnel may be down)"

echo ""
echo "Feedback: POST $BASE/cds-services/$SERVICE/feedback (create follow-up task)"
CARD_UUID=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['cards'][0].get('uuid',''))")
curl -sf -X POST "$BASE/cds-services/$SERVICE/feedback" \
  -H "Content-Type: application/json" \
  -H "Origin: https://sandbox.cds-hooks.org" \
  -d "{\"feedback\":[{\"card\":\"$CARD_UUID\",\"outcome\":\"accepted\",\"acceptedSuggestions\":[{\"id\":\"create-followup-review-task\"}],\"outcomeTimestamp\":\"2026-06-20T12:00:00Z\"}]}" \
  | python3 -m json.tool

if [[ "$BASE" == http://localhost* ]]; then
  echo ""
  echo "For Sandbox, expose :3000 with cloudflared and run: scripts/sandbox-url.sh"
fi
