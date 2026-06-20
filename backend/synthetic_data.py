"""
Synthetic patient data — Synthea-style FHIR records with 4 PLANTED PROBLEMS.
All data is entirely fictional. No real patient data.

Planted problems (for accuracy metrics):
  P001 — Critical potassium result (K=6.2) nobody saw for 21 days  [CRITICAL]
  P002 — CBC ordered 14 days ago, no result ever returned           [HIGH]
  P003 — Cardiology referral sent 35 days ago, no reply            [HIGH]
  P004 — OHIP billing file rejected, ~$840 never reconciled        [MEDIUM]
"""

from datetime import datetime, timedelta, timezone

NOW = datetime.now(timezone.utc)

def days_ago(n: int) -> str:
    return (NOW - timedelta(days=n)).isoformat()


PATIENTS = {
    "P001": {
        "id": "P001",
        "resourceType": "Patient",
        "name": [{"family": "Wallace", "given": ["James"]}],
        "gender": "male",
        "birthDate": "1958-03-14",
        "active_problems": ["Essential hypertension", "Chronic kidney disease stage 2"],
        "medications": [
            {"name": "Spironolactone", "dose": "25mg", "frequency": "once daily"},
            {"name": "Ramipril", "dose": "10mg", "frequency": "once daily"},
        ],
    },
    "P002": {
        "id": "P002",
        "resourceType": "Patient",
        "name": [{"family": "McLean", "given": ["Sarah"]}],
        "gender": "female",
        "birthDate": "1972-07-22",
        "active_problems": ["Type 2 diabetes mellitus", "Fatigue (under investigation)"],
        "medications": [
            {"name": "Metformin", "dose": "1000mg", "frequency": "twice daily"},
        ],
    },
    "P003": {
        "id": "P003",
        "resourceType": "Patient",
        "name": [{"family": "Chen", "given": ["Robert"]}],
        "gender": "male",
        "birthDate": "1965-11-03",
        "active_problems": ["Atrial fibrillation", "Heart failure (NYHA class II)"],
        "medications": [
            {"name": "Apixaban", "dose": "5mg", "frequency": "twice daily"},
            {"name": "Metoprolol", "dose": "50mg", "frequency": "twice daily"},
            {"name": "Furosemide", "dose": "40mg", "frequency": "once daily"},
        ],
    },
    "P004": {
        "id": "P004",
        "resourceType": "Patient",
        "name": [{"family": "Thompson", "given": ["Emily"]}],
        "gender": "female",
        "birthDate": "1980-05-18",
        "active_problems": ["Generalized anxiety disorder", "Iron-deficiency anaemia"],
        "medications": [
            {"name": "Sertraline", "dose": "50mg", "frequency": "once daily"},
            {"name": "Ferrous sulfate", "dose": "300mg", "frequency": "twice daily"},
        ],
    },
}

# ── Observations (lab results) ────────────────────────────────────────────────

OBSERVATIONS = [
    # PLANTED PROBLEM #1: Critical potassium — nobody saw it
    {
        "id": "OBS-001",
        "resourceType": "Observation",
        "subject": "P001",
        "code": {"code": "2823-3", "display": "Potassium [Moles/volume] in Serum or Plasma"},
        "valueQuantity": {"value": 6.2, "unit": "mEq/L"},
        "referenceRange": {"low": 3.5, "high": 5.0, "unit": "mEq/L"},
        "interpretation": "CRITICAL HIGH",
        "status": "final",
        "effectiveDateTime": days_ago(21),
        "reviewed": False,   # ← THE PLANTED PROBLEM
        "note": "Value critically elevated. Patient on spironolactone + ramipril — ACE/potassium-sparing combination.",
    },
    # Normal result for context
    {
        "id": "OBS-002",
        "resourceType": "Observation",
        "subject": "P001",
        "code": {"code": "2160-0", "display": "Creatinine [Mass/volume] in Serum or Plasma"},
        "valueQuantity": {"value": 1.3, "unit": "mg/dL"},
        "referenceRange": {"low": 0.7, "high": 1.3, "unit": "mg/dL"},
        "interpretation": "NORMAL",
        "status": "final",
        "effectiveDateTime": days_ago(21),
        "reviewed": True,
    },
    # P002 — HbA1c (reviewed)
    {
        "id": "OBS-003",
        "resourceType": "Observation",
        "subject": "P002",
        "code": {"code": "4548-4", "display": "Hemoglobin A1c/Hemoglobin.total in Blood"},
        "valueQuantity": {"value": 7.8, "unit": "%"},
        "referenceRange": {"low": None, "high": 7.0, "unit": "%"},
        "interpretation": "HIGH",
        "status": "final",
        "effectiveDateTime": days_ago(45),
        "reviewed": True,
    },
]

# ── Service Requests (test orders) ───────────────────────────────────────────

SERVICE_REQUESTS = [
    # PLANTED PROBLEM #2: CBC ordered, no result
    {
        "id": "SR-001",
        "resourceType": "ServiceRequest",
        "subject": "P002",
        "code": {"code": "58410-2", "display": "Complete blood count (CBC) panel"},
        "status": "active",           # should be 'completed' if result came back
        "authoredOn": days_ago(14),
        "result_received": False,     # ← THE PLANTED PROBLEM
        "note": "Investigating persistent fatigue. Rule out anaemia, infection.",
    },
    # A completed order (for contrast)
    {
        "id": "SR-002",
        "resourceType": "ServiceRequest",
        "subject": "P001",
        "code": {"code": "2823-3", "display": "Potassium panel"},
        "status": "completed",
        "authoredOn": days_ago(22),
        "result_received": True,
    },
]

# ── Referrals ─────────────────────────────────────────────────────────────────

REFERRALS = [
    # PLANTED PROBLEM #3: Cardiology referral, no acknowledgement
    {
        "id": "REF-001",
        "resourceType": "ServiceRequest",
        "subject": "P003",
        "intent": "referral",
        "specialty": "Cardiology",
        "reason": "Worsening dyspnoea on exertion, assess for cardiac resynchronisation therapy candidacy",
        "status": "active",
        "sentOn": days_ago(35),
        "acknowledged": False,        # ← THE PLANTED PROBLEM
        "urgency": "routine",
        "attachedForm": "eReferral-Ontario",
    },
    # A completed referral (for contrast)
    {
        "id": "REF-002",
        "resourceType": "ServiceRequest",
        "subject": "P002",
        "intent": "referral",
        "specialty": "Endocrinology",
        "reason": "Suboptimal diabetes control",
        "status": "completed",
        "sentOn": days_ago(60),
        "acknowledged": True,
    },
]

# ── Billing Claims ────────────────────────────────────────────────────────────

BILLING_CLAIMS = [
    # PLANTED PROBLEM #4: Rejected billing claim never reconciled
    {
        "id": "CLM-001",
        "subject": "P004",
        "ohip_codes": [
            {"code": "A007", "description": "Comprehensive consultation", "fee": 680.00},
            {"code": "G539", "description": "Anxiety — complex psychosocial assessment", "fee": 165.00},
        ],
        "submission_date": days_ago(22),
        "status": "rejected",         # ← THE PLANTED PROBLEM
        "rejection_reason": "Service code G539 not eligible with A007 on same date — requires modifier or separate claim",
        "total_at_risk": 845.00,
        "reconciled": False,
    },
    # A clean claim (for contrast)
    {
        "id": "CLM-002",
        "subject": "P001",
        "ohip_codes": [
            {"code": "A001", "description": "Minor assessment", "fee": 35.20},
        ],
        "submission_date": days_ago(10),
        "status": "paid",
        "reconciled": True,
        "total_at_risk": 0,
    },
]

# ── Playbook definitions ──────────────────────────────────────────────────────

PLAYBOOKS = {
    "abnormal-lab": {
        "id": "abnormal-lab",
        "name": "Abnormal Lab Result",
        "description": "When a critical/abnormal result arrives unreviewed, notify and act.",
        "steps": [
            {"id": "detect",   "label": "Detect Unreviewed Result", "type": "auto"},
            {"id": "analyze",  "label": "Analyze Clinical Context",  "type": "auto"},
            {"id": "draft",    "label": "Draft Recall + Repeat Lab", "type": "auto"},
            {"id": "gate",     "label": "⛔ Doctor Approval Required", "type": "gate"},
            {"id": "send",     "label": "Send Recall & Book Lab",    "type": "auto"},
            {"id": "track",    "label": "Track Until Closed",        "type": "auto"},
        ],
    },
    "billing-reconciliation": {
        "id": "billing-reconciliation",
        "name": "Billing Reconciliation",
        "description": "Find rejected claims and draft corrections to recover lost revenue.",
        "steps": [
            {"id": "scan",     "label": "Scan Rejected Claims",       "type": "auto"},
            {"id": "analyze",  "label": "Identify Coding Error",      "type": "auto"},
            {"id": "draft",    "label": "Draft Correction",           "type": "auto"},
            {"id": "gate",     "label": "⛔ Doctor Approval Required", "type": "gate"},
            {"id": "resubmit", "label": "Resubmit to OHIP",          "type": "auto"},
            {"id": "track",    "label": "Confirm Payment",            "type": "auto"},
        ],
    },
    "pending-test": {
        "id": "pending-test",
        "name": "Pending Test — No Result",
        "description": "Follow up with lab when an ordered test has no result after threshold.",
        "steps": [
            {"id": "detect",   "label": "Detect Overdue Test Order",  "type": "auto"},
            {"id": "analyze",  "label": "Check Clinical Urgency",     "type": "auto"},
            {"id": "draft",    "label": "Draft Lab Follow-up",        "type": "auto"},
            {"id": "gate",     "label": "⛔ Doctor Approval Required", "type": "gate"},
            {"id": "contact",  "label": "Contact Lab",                "type": "auto"},
            {"id": "track",    "label": "Track Until Result Received", "type": "auto"},
        ],
    },
    "referral-no-reply": {
        "id": "referral-no-reply",
        "name": "Referral — No Reply",
        "description": "Escalate when a specialist hasn't acknowledged a referral.",
        "steps": [
            {"id": "detect",   "label": "Detect Unanswered Referral", "type": "auto"},
            {"id": "analyze",  "label": "Assess Urgency & Timeline",  "type": "auto"},
            {"id": "draft",    "label": "Draft Escalation Message",   "type": "auto"},
            {"id": "gate",     "label": "⛔ Doctor Approval Required", "type": "gate"},
            {"id": "escalate", "label": "Send Escalation",            "type": "auto"},
            {"id": "track",    "label": "Track Acknowledgement",      "type": "auto"},
        ],
    },
}
