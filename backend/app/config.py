"""Central config. All knobs in one place so detection stays inspectable."""
import os
from dotenv import load_dotenv

load_dotenv()

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
