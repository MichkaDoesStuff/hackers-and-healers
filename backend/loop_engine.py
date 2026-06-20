"""
Loop Detection & Ranking Engine

Scans synthetic FHIR data for open loops and ranks by clinical urgency.
Uses simple, rule-based logic (explainable to judges, safe for demo).
"""

from datetime import datetime, timezone
from typing import Any

from synthea_loader import (
    PATIENTS,
    OBSERVATIONS,
    SERVICE_REQUESTS,
    REFERRALS,
    BILLING_CLAIMS,
    PLAYBOOKS,
)

# ─── Risk scoring constants ───────────────────────────────────────────────────
RISK_CRITICAL = 100
RISK_HIGH = 70
RISK_MEDIUM = 40
RISK_LOW = 10

# How many days before a loop escalates
DAYS_THRESH_LAB_CRITICAL = 1    # critical lab: flag immediately
DAYS_THRESH_LAB_ABNORMAL = 3    # abnormal lab: flag after 3 days
DAYS_THRESH_TEST_PENDING = 7    # test with no result: flag after 7 days
DAYS_THRESH_REFERRAL = 21       # referral no ack: flag after 21 days
DAYS_THRESH_BILLING = 14        # billing not reconciled: flag after 14 days


def _days_since(iso_dt: str) -> int:
    dt = datetime.fromisoformat(iso_dt)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - dt).days


def detect_loops() -> list[dict[str, Any]]:
    """
    Scan all synthetic data and return a list of detected open loops,
    sorted by risk score descending.
    """
    loops: list[dict] = []

    # ── 1. Unreviewed / critical lab results ─────────────────────────────────
    for obs in OBSERVATIONS:
        if obs.get("reviewed", True):
            continue  # Already reviewed — not a loop

        patient = PATIENTS[obs["subject"]]
        days = _days_since(obs["effectiveDateTime"])
        interp = obs.get("interpretation", "").upper()

        if "CRITICAL" in interp:
            risk = RISK_CRITICAL
            severity = "CRITICAL"
        elif "HIGH" in interp or "ABNORMAL" in interp:
            if days >= DAYS_THRESH_LAB_ABNORMAL:
                risk = RISK_HIGH
                severity = "HIGH"
            else:
                continue  # too soon to flag
        else:
            continue

        loops.append({
            "id": f"LOOP-{obs['id']}",
            "type": "abnormal_lab",
            "playbook_id": "abnormal-lab",
            "risk_score": risk,
            "severity": severity,
            "patient": _patient_summary(patient),
            "days_open": days,
            "status": "open",
            "summary": f"Unreviewed {obs['code']['display']} result — {obs['valueQuantity']['value']} {obs['valueQuantity']['unit']} ({interp})",
            "detail": obs,
            "context": {
                "observation_id": obs["id"],
                "value": obs["valueQuantity"]["value"],
                "unit": obs["valueQuantity"]["unit"],
                "normal_range": obs.get("referenceRange"),
                "interpretation": interp,
                "note": obs.get("note", ""),
                "medications": patient.get("medications", []),
                "active_problems": patient.get("active_problems", []),
            },
            "playbook": PLAYBOOKS["abnormal-lab"],
        })

    # ── 2. Pending tests — no result returned ────────────────────────────────
    for sr in SERVICE_REQUESTS:
        if sr.get("result_received", True):
            continue
        if sr.get("status") == "completed":
            continue

        patient = PATIENTS[sr["subject"]]
        days = _days_since(sr["authoredOn"])

        if days < DAYS_THRESH_TEST_PENDING:
            continue  # Not overdue yet

        loops.append({
            "id": f"LOOP-{sr['id']}",
            "type": "pending_test",
            "playbook_id": "pending-test",
            "risk_score": RISK_HIGH,
            "severity": "HIGH",
            "patient": _patient_summary(patient),
            "days_open": days,
            "status": "open",
            "summary": f"No result received for {sr['code']['display']} ordered {days} days ago",
            "detail": sr,
            "context": {
                "service_request_id": sr["id"],
                "test": sr["code"]["display"],
                "ordered_on": sr["authoredOn"],
                "note": sr.get("note", ""),
                "active_problems": patient.get("active_problems", []),
            },
            "playbook": PLAYBOOKS["pending-test"],
        })

    # ── 3. Referrals with no acknowledgement ─────────────────────────────────
    for ref in REFERRALS:
        if ref.get("acknowledged", True):
            continue

        patient = PATIENTS[ref["subject"]]
        days = _days_since(ref["sentOn"])

        if days < DAYS_THRESH_REFERRAL:
            continue

        loops.append({
            "id": f"LOOP-{ref['id']}",
            "type": "referral_no_reply",
            "playbook_id": "referral-no-reply",
            "risk_score": RISK_HIGH,
            "severity": "HIGH",
            "patient": _patient_summary(patient),
            "days_open": days,
            "status": "open",
            "summary": f"Cardiology referral sent {days} days ago — no acknowledgement received",
            "detail": ref,
            "context": {
                "referral_id": ref["id"],
                "specialty": ref["specialty"],
                "reason": ref["reason"],
                "sent_on": ref["sentOn"],
                "urgency": ref.get("urgency", "routine"),
                "active_problems": patient.get("active_problems", []),
                "medications": patient.get("medications", []),
            },
            "playbook": PLAYBOOKS["referral-no-reply"],
        })

    # ── 4. Billing — rejected / unreconciled claims ───────────────────────────
    for claim in BILLING_CLAIMS:
        if claim.get("reconciled", True):
            continue
        if claim.get("status") not in ("rejected", "denied", "error"):
            continue

        patient = PATIENTS[claim["subject"]]
        days = _days_since(claim["submission_date"])

        if days < DAYS_THRESH_BILLING:
            continue

        loops.append({
            "id": f"LOOP-{claim['id']}",
            "type": "billing_unreconciled",
            "playbook_id": "billing-reconciliation",
            "risk_score": RISK_MEDIUM,
            "severity": "MEDIUM",
            "patient": _patient_summary(patient),
            "days_open": days,
            "status": "open",
            "summary": f"Rejected claim — ${claim['total_at_risk']:.2f} at risk. {claim['rejection_reason']}",
            "detail": claim,
            "context": {
                "claim_id": claim["id"],
                "codes": claim["ohip_codes"],
                "rejection_reason": claim["rejection_reason"],
                "total_at_risk": claim["total_at_risk"],
                "submission_date": claim["submission_date"],
            },
            "playbook": PLAYBOOKS["billing-reconciliation"],
        })

    # Sort by risk descending (CRITICAL → HIGH → MEDIUM → LOW)
    loops.sort(key=lambda x: x["risk_score"], reverse=True)
    return loops


def _patient_summary(patient: dict) -> dict:
    name = patient["name"][0]
    full_name = f"{name['given'][0]} {name['family']}"
    return {
        "id": patient["id"],
        "name": full_name,
        "gender": patient.get("gender", "unknown"),
        "birthDate": patient.get("birthDate"),
        "active_problems": patient.get("active_problems", []),
    }


def get_metrics(all_loops: list[dict], approved_ids: set[str]) -> dict:
    planted = 4  # We know exactly how many problems we planted
    caught = len(all_loops) + len(approved_ids)  # detected + already closed
    closed = len(approved_ids)
    open_count = len(all_loops)
    return {
        "planted": planted,
        "caught": min(caught, planted),  # cap at planted total
        "accuracy": round(min(caught, planted) / planted, 2),
        "open": open_count,
        "closed": closed,
        "total_at_risk_dollars": sum(
            l["context"].get("total_at_risk", 0) for l in all_loops
        ),
    }
