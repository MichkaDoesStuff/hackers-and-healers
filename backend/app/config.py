"""Central config. All knobs in one place so detection stays inspectable."""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env (service config) then the repo-root .env (shared secrets like
# Twilio). Root is loaded with override=False so service-specific values win. This
# runs regardless of cwd, so the root .env is picked up even though the backend is
# started from backend/.
_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_ROOT / "backend" / ".env")
load_dotenv(_ROOT / ".env", override=False)

# FHIR server (HAPI) base URL.
FHIR_BASE = os.getenv("FHIR_BASE", "http://localhost:8080/fhir")

# Detection thresholds (days). These are deliberately visible config, not magic numbers.
ABNORMAL_UNACKED_DAYS = int(os.getenv("ABNORMAL_UNACKED_DAYS", "7"))
ORDERED_NOT_RESULTED_DAYS = int(os.getenv("ORDERED_NOT_RESULTED_DAYS", "14"))
REFERRAL_NO_RESPONSE_DAYS = int(os.getenv("REFERRAL_NO_RESPONSE_DAYS", "10"))

# Abnormal interpretation codes that count (HL7 v3 ObservationInterpretation).
ABNORMAL_INTERPRETATIONS = {"H", "L", "HH", "LL", "A", "AA"}
CRITICAL_INTERPRETATIONS = {"HH", "LL", "AA"}

# Risk scoring weights (deterministic). Printed in the UI as "why this rank".
RISK_WEIGHTS = {
    "severity": 50,       # critical lab dominates
    "overdue": 2,         # per day past the loop's window
    "vulnerability": 5,   # per comorbidity / high-risk factor
    "harm": 1,            # per-loop-type base harm
}

# Per-loop-type base harm weight.
LOOP_TYPE_HARM = {
    "abnormal_result": 40,
    "ordered_not_resulted": 25,
    "referral_no_response": 20,
    "billing_unreconciled": 15,
}

# CORS origins for the frontend dev server.
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
).split(",")

# Twilio Programmable Voice — outbound AI call that phones patients to book an
# appointment (greeting + TwiML <Gather> conversation). With no SID/token/number
# (or no PUBLIC_BASE_URL for the webhooks) the call is SIMULATED locally so the
# workflow still runs end-to-end.
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")  # your Twilio voice number, E.164
TWILIO_API_BASE = os.getenv("TWILIO_API_BASE", "https://api.twilio.com").rstrip("/")

# Public URL that fronts this app (e.g. the Cloudflare tunnel) so Twilio can reach
# our TwiML voice webhooks at {PUBLIC_BASE_URL}/api/voice/*.
PUBLIC_BASE_URL = (os.getenv("PUBLIC_BASE_URL") or os.getenv("LOOP_APP_URL", "")).rstrip("/")

# Calendar push target for booked appointments. Optional generic webhook — the
# integration point for Google Calendar / Outlook / a clinic scheduler. Empty =
# local "custom calendar" store only (always available, exposes an .ics per visit).
CALENDAR_WEBHOOK_URL = os.getenv("CALENDAR_WEBHOOK_URL", "")
CLINIC_TIMEZONE = os.getenv("CLINIC_TIMEZONE", "America/Toronto")
