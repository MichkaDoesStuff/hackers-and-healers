"""Plant known 'open loops' onto loaded Synthea patients and write eval ground truth.

Synthea patients are too healthy to demo, so we inject the exact problems Loop
should catch. The list we plant here doubles as the accuracy ground truth.

Run AFTER load_synthea.py:
    python data/inject_loops.py
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

FHIR_BASE = os.getenv("FHIR_BASE", "http://localhost:8080/fhir")
HEADERS = {"Accept": "application/fhir+json", "Content-Type": "application/fhir+json"}
MONEY_EXT = "http://loop.health/money-at-risk"
REJECTED_EXT = "http://loop.health/rejected-lines"
GROUND_TRUTH = Path(__file__).parent / "ground_truth.json"
ACTIONED = Path(__file__).parent / "actioned.json"


def days_ago_iso(n: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()


def create(client: httpx.Client, resource: dict) -> dict:
    r = client.post(f"{FHIR_BASE}/{resource['resourceType']}", json=resource)
    r.raise_for_status()
    return r.json()


def get_patients(client: httpx.Client, n: int) -> list[dict]:
    r = client.get(f"{FHIR_BASE}/Patient", params={"_count": str(n)})
    r.raise_for_status()
    return [e["resource"] for e in r.json().get("entry", [])]


def pref(p: dict) -> str:
    return f"Patient/{p['id']}"


def main() -> int:
    truth: list[dict] = []
    with httpx.Client(timeout=60.0, headers=HEADERS) as client:
        patients = get_patients(client, 6)
        if len(patients) < 4:
            print("Not enough patients loaded. Run data/load_synthea.py first.")
            return 1

        p_crit, p_order, p_ref, p_bill = patients[0], patients[1], patients[2], patients[3]

        # 1) Critical potassium, unreviewed ~19 days, no follow-up Task.
        obs = create(client, {
            "resourceType": "Observation",
            "status": "final",
            "category": [{"coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                "code": "laboratory"}]}],
            "code": {"coding": [{"system": "http://loinc.org", "code": "6298-4",
                                 "display": "Potassium"}], "text": "Potassium"},
            "subject": {"reference": pref(p_crit)},
            "effectiveDateTime": days_ago_iso(19),
            "issued": days_ago_iso(19),
            "valueQuantity": {"value": 6.1, "unit": "mmol/L",
                              "system": "http://unitsofmeasure.org", "code": "mmol/L"},
            "interpretation": [{"coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                "code": "HH", "display": "Critical high"}]}],
            "referenceRange": [{"low": {"value": 3.5}, "high": {"value": 5.1}}],
        })
        truth.append({"type": "abnormal_result", "focus": f"Observation/{obs['id']}", "patient": p_crit["id"]})

        # 2) HbA1c ordered ~20 days ago, no result returned.
        sr_order = create(client, {
            "resourceType": "ServiceRequest",
            "status": "active", "intent": "order",
            "category": [{"coding": [{
                "system": "http://snomed.info/sct", "code": "108252007",
                "display": "Laboratory procedure"}]}],
            "code": {"coding": [{"system": "http://loinc.org", "code": "4548-4",
                                 "display": "Hemoglobin A1c"}], "text": "Hemoglobin A1c"},
            "subject": {"reference": pref(p_order)},
            "authoredOn": days_ago_iso(20),
        })
        truth.append({"type": "ordered_not_resulted", "focus": f"ServiceRequest/{sr_order['id']}", "patient": p_order["id"]})

        # 3) Cardiology referral, no reply ~12 days.
        sr_ref = create(client, {
            "resourceType": "ServiceRequest",
            "status": "active", "intent": "order",
            "code": {"text": "Referral to Cardiology"},
            "subject": {"reference": pref(p_ref)},
            "authoredOn": days_ago_iso(12),
        })
        truth.append({"type": "referral_no_response", "focus": f"ServiceRequest/{sr_ref['id']}", "patient": p_ref["id"]})

        # 4) Billing batch with rejected lines, money at risk, not reconciled.
        cr = create(client, {
            "resourceType": "ClaimResponse",
            "status": "active",
            "type": {"coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/claim-type",
                "code": "professional"}]},
            "use": "claim",
            "patient": {"reference": pref(p_bill)},
            "created": days_ago_iso(5),
            "insurer": {"display": "OHIP"},
            "outcome": "error",
            "identifier": [{"value": "2291"}],
            "extension": [
                {"url": MONEY_EXT, "valueDecimal": 1240},
                {"url": REJECTED_EXT, "valueDecimal": 14},
            ],
        })
        truth.append({"type": "billing_unreconciled", "focus": f"ClaimResponse/{cr['id']}", "patient": p_bill["id"]})

    GROUND_TRUTH.write_text(json.dumps(truth, indent=2))
    if ACTIONED.exists():
        ACTIONED.unlink()  # fresh data = nothing actioned yet
    print(f"Injected {len(truth)} loops. Ground truth -> {GROUND_TRUTH}")
    for t in truth:
        print(f"  {t['type']:24} {t['focus']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
