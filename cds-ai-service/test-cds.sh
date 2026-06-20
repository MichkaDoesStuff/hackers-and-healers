#!/usr/bin/env bash
# Quick CDS Hooks smoke test — local backend or deployed lohp.
set -euo pipefail

BASE="${1:-https://lohp.ryanbeland.dev}"
SERVICE="${2:-triage-assistant}"
PATIENT_ID="${3:-}"

if [[ -z "$PATIENT_ID" ]]; then
  PATIENT_ID="$(curl -s "$BASE/api/patients" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'])")"
fi

echo "Discovery: $BASE/cds-services"
curl -s "$BASE/cds-services" | python3 -m json.tool

echo ""
echo "Hook: POST $BASE/cds-services/$SERVICE (patient=$PATIENT_ID)"
curl -s -X POST "$BASE/cds-services/$SERVICE" \
  -H "Content-Type: application/json" \
  -d "{\"hook\":\"patient-view\",\"hookInstance\":\"smoke-test\",\"context\":{\"patientId\":\"$PATIENT_ID\",\"userId\":\"Practitioner/example\"},\"prefetch\":{}}" \
  | python3 -m json.tool
