#!/usr/bin/env bash
# Agent Platform (Vertex AI) / Gemini ADC setup for local development.
# Use eternalvolks@gmail.com — it owns the hackathon GCP project with billing.
set -euo pipefail

GCLOUD="${GCLOUD:-gcloud}"
ACCOUNT="${GOOGLE_ACCOUNT:-eternalvolks@gmail.com}"
PROJECT="${GOOGLE_CLOUD_PROJECT:-project-0a4fffd1-40be-4d34-9a9}"
LOCATION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
MODEL="${GOOGLE_GENAI_MODEL:-gemini-2.5-flash}"

echo "Account:  $ACCOUNT"
echo "Project:  $PROJECT"
echo "Location: $LOCATION"
echo "Model:    $MODEL"

"$GCLOUD" config set account "$ACCOUNT"
"$GCLOUD" config set project "$PROJECT"

echo "Enabling Vertex AI API (aiplatform.googleapis.com)..."
"$GCLOUD" services enable aiplatform.googleapis.com --project="$PROJECT" || true

echo ""
echo "Application Default Credentials (opens browser once)..."
"$GCLOUD" auth application-default login --project="$PROJECT"

echo ""
echo "Setting ADC quota project..."
"$GCLOUD" auth application-default set-quota-project "$PROJECT"

echo ""
echo "Verifying Gemini access..."
TOKEN=$("$GCLOUD" auth application-default print-access-token)
HTTP=$(curl -s -o /tmp/vertex-test.json -w "%{http_code}" -X POST \
  "https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"role":"user","parts":[{"text":"Say OK"}]}]}')

if [[ "$HTTP" == "200" ]]; then
  echo "✅ Agent Platform Gemini is working."
  python3 -c "import json; r=json.load(open('/tmp/vertex-test.json')); print(r['candidates'][0]['content']['parts'][0]['text'])"
else
  echo "⚠️  API returned HTTP $HTTP"
  cat /tmp/vertex-test.json
  echo ""
fi

echo ""
echo "Add to your shell or .env:"
echo "  export GOOGLE_CLOUD_PROJECT=$PROJECT"
echo "  export GOOGLE_CLOUD_LOCATION=$LOCATION"
echo "  export GOOGLE_GENAI_USE_VERTEXAI=true"
