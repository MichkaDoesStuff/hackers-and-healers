"""
synthea_loader.py
─────────────────
Loads patient, observation, condition, and medication data from the real
Synthea CSV export at ../synthea_sample_data_csv_latest/.

Replaces the hard-coded dicts in synthetic_data.py with real Synthea records,
and PLANTS 4 known problems (one per domain) on top of the real data so
the accuracy story still works for the demo.

CSV columns used:
  patients.csv       → Id, FIRST, LAST, GENDER, BIRTHDATE
  observations.csv   → DATE, PATIENT, DESCRIPTION, VALUE, UNITS, CATEGORY, TYPE
  conditions.csv     → START, STOP, PATIENT, DESCRIPTION
  medications.csv    → START, STOP, PATIENT, DESCRIPTION
"""

import csv
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

# ── Path to the CSV folder ────────────────────────────────────────────────────
CSV_DIR = Path(__file__).parent.parent / "synthea_sample_data_csv_latest"

NOW = datetime.now(timezone.utc)


def _days_ago(n: int) -> str:
    return (NOW - timedelta(days=n)).isoformat()


def _load_csv(filename: str) -> list[dict]:
    path = CSV_DIR / filename
    if not path.exists():
        print(f"[synthea_loader] WARNING: {path} not found, returning empty list.")
        return []
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


# ── 1. Load patients ──────────────────────────────────────────────────────────
def _build_patients() -> dict:
    rows = _load_csv("patients.csv")
    patients = {}
    for row in rows:
        pid = row["Id"]
        patients[pid] = {
            "id": pid,
            "resourceType": "Patient",
            "name": [{"family": row.get("LAST", ""), "given": [row.get("FIRST", "")]}],
            "gender": row.get("GENDER", "unknown").lower(),
            "birthDate": row.get("BIRTHDATE", ""),
            # These are filled in below from conditions/medications
            "active_problems": [],
            "medications": [],
        }
    return patients


# ── 2. Load active conditions per patient ────────────────────────────────────
def _attach_conditions(patients: dict) -> None:
    rows = _load_csv("conditions.csv")
    for row in rows:
        pid = row.get("PATIENT", "")
        # Only active conditions (no STOP date)
        if pid in patients and not row.get("STOP"):
            desc = row.get("DESCRIPTION", "")
            # Filter out Synthea social history findings like 'Educated to high school level (finding)'
            if desc and "(finding)" not in desc and desc not in patients[pid]["active_problems"]:
                patients[pid]["active_problems"].append(desc)


# ── 3. Load active medications per patient ────────────────────────────────────
def _attach_medications(patients: dict) -> None:
    rows = _load_csv("medications.csv")
    for row in rows:
        pid = row.get("PATIENT", "")
        if pid in patients and not row.get("STOP"):
            desc = row.get("DESCRIPTION", "")
            if desc and len(patients[pid]["medications"]) < 5:
                patients[pid]["medications"].append({
                    "name": desc,
                    "dose": "—",
                    "frequency": "as prescribed",
                })


# ── 4. Build observations (lab-like only) ────────────────────────────────────
# Lab thresholds for common LOINC-named fields in Synthea
LAB_THRESHOLDS = {
    "Potassium": {"low": 3.5, "high": 5.0, "unit": "mmol/L", "critical_high": 6.0, "critical_low": 2.5},
    "Hemoglobin A1c": {"low": None, "high": 7.0, "unit": "%"},
    "Glucose": {"low": 70.0, "high": 140.0, "unit": "mg/dL", "critical_high": 400.0, "critical_low": 50.0},
    "Creatinine": {"low": 0.5, "high": 1.3, "unit": "mg/dL"},
    "Cholesterol": {"low": None, "high": 200.0, "unit": "mg/dL"},
    "eGFR": {"low": 60.0, "high": None, "unit": "mL/min/1.73m2"},
    "Urea nitrogen": {"low": 7.0, "high": 25.0, "unit": "mg/dL"},
}

def _interpret(desc: str, value: float) -> str | None:
    """Return CRITICAL HIGH / HIGH / CRITICAL LOW / LOW / NORMAL for known lab types."""
    for key, thresh in LAB_THRESHOLDS.items():
        if key.lower() in desc.lower():
            crit_hi = thresh.get("critical_high")
            crit_lo = thresh.get("critical_low")
            hi = thresh.get("high")
            lo = thresh.get("low")
            if crit_hi and value >= crit_hi:
                return "CRITICAL HIGH"
            if crit_lo and value <= crit_lo:
                return "CRITICAL LOW"
            if hi and value > hi:
                return "HIGH"
            if lo and value < lo:
                return "LOW"
            return "NORMAL"
    return None  # Not a tracked lab


def _build_observations(patients: dict) -> list[dict]:
    rows = _load_csv("observations.csv")
    observations = []
    seen = 0
    for row in rows:
        if row.get("TYPE") != "numeric":
            continue
        pid = row.get("PATIENT", "")
        if pid not in patients:
            continue
        desc = row.get("DESCRIPTION", "")
        raw_val = row.get("VALUE", "")
        try:
            value = float(raw_val)
        except (ValueError, TypeError):
            continue

        interp = _interpret(desc, value)
        if interp is None:
            continue  # Skip non-tracked observations

        obs = {
            "id": f"OBS-{pid[:6]}-{seen}",
            "resourceType": "Observation",
            "subject": pid,
            "code": {"display": desc},
            "valueQuantity": {"value": value, "unit": row.get("UNITS", "")},
            "interpretation": interp,
            "status": "final",
            "effectiveDateTime": row.get("DATE", _days_ago(10)),
            "reviewed": True,  # Real data is treated as already reviewed
        }
        observations.append(obs)
        seen += 1

    return observations


# ── 5. Plant the 4 demo problems ─────────────────────────────────────────────
def _plant_problems(patients: dict, observations: list) -> tuple[list, list, list]:
    """
    Inject 4 known problems into the data:
      P-DEMO-1  Critical potassium never reviewed
      P-DEMO-2  CBC ordered, no result (→ SERVICE_REQUESTS)
      P-DEMO-3  Cardiology referral, no ack (→ REFERRALS)
      P-DEMO-4  Rejected billing claim (→ BILLING_CLAIMS)
    Uses first 4 real Synthea patients so names/DOBs are real.
    """
    sorted_pids = sorted(patients.keys())[:4]

    # Ensure at least 4 patients exist (pad with hard-coded if dataset small)
    _ensure_demo_patients(patients, sorted_pids)

    p1, p2, p3, p4 = sorted_pids[:4]

    # Plant #1 – critical potassium on p1
    observations.append({
        "id": "OBS-PLANTED-K",
        "resourceType": "Observation",
        "subject": p1,
        "code": {"code": "2823-3", "display": "Potassium [Moles/volume] in Serum or Plasma"},
        "valueQuantity": {"value": 6.2, "unit": "mEq/L"},
        "referenceRange": {"low": 3.5, "high": 5.0, "unit": "mEq/L"},
        "interpretation": "CRITICAL HIGH",
        "status": "final",
        "effectiveDateTime": _days_ago(21),
        "reviewed": False,
        "note": "PLANTED PROBLEM #1: Critically elevated potassium, unreviewed for 21 days.",
    })

    service_requests = [
        # Plant #2 – CBC no result on p2
        {
            "id": "SR-PLANTED-CBC",
            "resourceType": "ServiceRequest",
            "subject": p1,
            "code": {"code": "58410-2", "display": "Complete blood count (CBC) panel"},
            "status": "active",
            "authoredOn": _days_ago(14),
            "result_received": False,
            "note": "PLANTED PROBLEM #2: CBC ordered for fatigue workup, no result returned.",
        }
    ]

    referrals = [
        # Plant #3 – cardiology referral no ack on p3
        {
            "id": "REF-PLANTED-CARDIO",
            "resourceType": "ServiceRequest",
            "subject": p1,
            "intent": "referral",
            "specialty": "Cardiology",
            "reason": "Worsening dyspnoea on exertion, assess for cardiac resynchronisation therapy candidacy",
            "status": "active",
            "sentOn": _days_ago(35),
            "acknowledged": False,
            "urgency": "routine",
            "attachedForm": "eReferral-Ontario",
        }
    ]

    billing_claims = [
        # Plant #4 – rejected OHIP billing claim on p4
        {
            "id": "CLM-PLANTED-OHIP",
            "subject": p1,
            "ohip_codes": [
                {"code": "A007", "description": "Comprehensive consultation", "fee": 680.00},
                {"code": "G539", "description": "Anxiety — complex psychosocial assessment", "fee": 165.00},
            ],
            "submission_date": _days_ago(22),
            "status": "rejected",
            "rejection_reason": "Service code G539 not eligible with A007 on same date — requires modifier or separate claim",
            "total_at_risk": 845.00,
            "reconciled": False,
        }
    ]

    return service_requests, referrals, billing_claims


def _ensure_demo_patients(patients: dict, sorted_pids: list) -> None:
    """Fill in any missing demo patients with fallback data."""
    fallbacks = [
        {"id": "P-DEMO-1", "first": "James", "last": "Wallace", "gender": "male", "dob": "1958-03-14"},
        {"id": "P-DEMO-2", "first": "Sarah", "last": "McLean", "gender": "female", "dob": "1972-07-22"},
        {"id": "P-DEMO-3", "first": "Robert", "last": "Chen", "gender": "male", "dob": "1965-11-03"},
        {"id": "P-DEMO-4", "first": "Emily", "last": "Thompson", "gender": "female", "dob": "1980-05-18"},
    ]
    for i, fb in enumerate(fallbacks):
        if len(sorted_pids) <= i:
            pid = fb["id"]
            patients[pid] = {
                "id": pid,
                "resourceType": "Patient",
                "name": [{"family": fb["last"], "given": [fb["first"]]}],
                "gender": fb["gender"],
                "birthDate": fb["dob"],
                "active_problems": [],
                "medications": [],
            }
            sorted_pids.append(pid)


# ── 6. Build the PLAYBOOKS (same as before, no CSV needed) ───────────────────
PLAYBOOKS = {
    "abnormal-lab": {
        "id": "abnormal-lab",
        "name": "Abnormal Lab Result",
        "description": "When a critical/abnormal result arrives unreviewed, notify and act.",
        "steps": [
            {"id": "detect", "label": "Detect Unreviewed Result", "type": "auto"},
            {"id": "analyze", "label": "Analyze Clinical Context", "type": "auto"},
            {"id": "draft", "label": "Draft Recall + Repeat Lab", "type": "auto"},
            {"id": "gate", "label": "⛔ Doctor Approval Required", "type": "gate"},
            {"id": "send", "label": "Send Recall & Book Lab", "type": "auto"},
            {"id": "track", "label": "Track Until Closed", "type": "auto"},
        ],
    },
    "billing-reconciliation": {
        "id": "billing-reconciliation",
        "name": "Billing Reconciliation",
        "description": "Find rejected claims and draft corrections to recover lost revenue.",
        "steps": [
            {"id": "scan", "label": "Scan Rejected Claims", "type": "auto"},
            {"id": "analyze", "label": "Identify Coding Error", "type": "auto"},
            {"id": "draft", "label": "Draft Correction", "type": "auto"},
            {"id": "gate", "label": "⛔ Doctor Approval Required", "type": "gate"},
            {"id": "resubmit", "label": "Resubmit to OHIP", "type": "auto"},
            {"id": "track", "label": "Confirm Payment", "type": "auto"},
        ],
    },
    "pending-test": {
        "id": "pending-test",
        "name": "Pending Test — No Result",
        "description": "Follow up with lab when an ordered test has no result after threshold.",
        "steps": [
            {"id": "detect", "label": "Detect Overdue Test Order", "type": "auto"},
            {"id": "analyze", "label": "Check Clinical Urgency", "type": "auto"},
            {"id": "draft", "label": "Draft Lab Follow-up", "type": "auto"},
            {"id": "gate", "label": "⛔ Doctor Approval Required", "type": "gate"},
            {"id": "contact", "label": "Contact Lab", "type": "auto"},
            {"id": "track", "label": "Track Until Result Received", "type": "auto"},
        ],
    },
    "referral-no-reply": {
        "id": "referral-no-reply",
        "name": "Referral — No Reply",
        "description": "Escalate when a specialist hasn't acknowledged a referral.",
        "steps": [
            {"id": "detect", "label": "Detect Unanswered Referral", "type": "auto"},
            {"id": "analyze", "label": "Assess Urgency & Timeline", "type": "auto"},
            {"id": "draft", "label": "Draft Escalation Message", "type": "auto"},
            {"id": "gate", "label": "⛔ Doctor Approval Required", "type": "gate"},
            {"id": "escalate", "label": "Send Escalation", "type": "auto"},
            {"id": "track", "label": "Track Acknowledgement", "type": "auto"},
        ],
    },
}


# ── 7. Public API (mirrors synthetic_data.py exports) ────────────────────────
print("[synthea_loader] Loading Synthea CSVs…")
PATIENTS = _build_patients()
_attach_conditions(PATIENTS)
_attach_medications(PATIENTS)
OBSERVATIONS = _build_observations(PATIENTS)
SERVICE_REQUESTS, REFERRALS, BILLING_CLAIMS = _plant_problems(PATIENTS, OBSERVATIONS)
print(
    f"[synthea_loader] Loaded {len(PATIENTS)} patients, "
    f"{len(OBSERVATIONS)} tracked observations, "
    f"+ 4 planted problems."
)
