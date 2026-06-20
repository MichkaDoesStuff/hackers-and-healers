"""Build the clinic view (patients + issues) in the frontend's shape, from real FHIR.

Maps Loop's internal model -> the Next.js frontend's Patient/Issue types so the
polished UI runs on live detected data instead of static mock data.
"""
from __future__ import annotations

import re
from datetime import date, datetime

from .detectors import detect_all
from .fhir import FhirClient
from .models import Loop
from .risk import rank
from .util import code_text

# band -> frontend Severity (critical | warning | routine)
SEVERITY = {"critical": "critical", "high": "warning", "medium": "warning", "routine": "routine"}
# loop type -> frontend IssueCategory
CATEGORY = {
    "abnormal_result": "lab",
    "ordered_not_resulted": "lab",
    "referral_no_response": "referral",
    "billing_unreconciled": "billing",
}
CLEAR_PATIENTS = 6  # how many healthy patients to also show


def build_clinic(fhir: FhirClient) -> list[dict]:
    loops = rank(detect_all(fhir))
    by_patient: dict[str, list[Loop]] = {}
    cards: list[dict] = []

    for loop in loops:
        if loop.type == "billing_unreconciled":
            cards.append(_billing_card(loop))
        else:
            by_patient.setdefault(loop.patient_id, []).append(loop)

    seen = set(by_patient.keys())
    for pid, plist in by_patient.items():
        patient = fhir.read("Patient", pid) or {"id": pid}
        cards.append(_patient_card(fhir, patient, plist))

    # add some "all clear" patients so the list isn't only problems
    for patient in fhir.search("Patient", {"_count": str(CLEAR_PATIENTS + len(seen) + 4)}):
        if patient.get("id") in seen:
            continue
        cards.append(_patient_card(fhir, patient, []))
        seen.add(patient.get("id"))
        if len([c for c in cards if not c["issues"]]) >= CLEAR_PATIENTS:
            break

    return cards


def _issue(loop: Loop, card_id: str, card_name: str) -> dict:
    title = loop.title
    if " - " in title and loop.type != "billing_unreconciled":
        title = title.split(" - ", 1)[1]
    return {
        "id": loop.id,
        "patientId": card_id,
        "patientName": card_name,
        "title": title,
        "summary": loop.subtitle,
        "severity": SEVERITY.get(loop.band, "routine"),
        "category": CATEGORY.get(loop.type, "follow-up"),
        "ageDays": loop.detected_days_ago,
        "source": "loop-billing" if loop.type == "billing_unreconciled" else "loop-summary",
        "detail": ". ".join(loop.why) + ".",
    }


def _billing_card(loop: Loop) -> dict:
    cid = f"billing-{loop.id}"
    name = loop.title  # "Billing - batch #2291"
    return {
        "id": cid,
        "name": name,
        "age": 0,
        "sex": "M",
        "mrn": "CLAIM",
        "conditions": ["Claims batch"],
        "medications": [],
        "lastSeen": "—",
        "issues": [_issue(loop, cid, name)],
    }


def _patient_card(fhir: FhirClient, patient: dict, loops: list[Loop]) -> dict:
    pid = patient.get("id", "")
    name = _clean_name(patient)
    return {
        "id": pid,
        "name": name,
        "age": _age(patient.get("birthDate")),
        "sex": "F" if patient.get("gender") == "female" else "M",
        "mrn": _mrn(patient),
        "conditions": _conditions(fhir, pid),
        "medications": _medications(fhir, pid),
        "lastSeen": _last_seen(fhir, pid),
        "issues": [_issue(l, pid, name) for l in loops],
    }


def _clean_name(patient: dict) -> str:
    names = patient.get("name") or []
    if not names:
        return f"Patient {patient.get('id', '?')}"
    n = names[0]
    given = re.sub(r"\d+", "", (n.get("given") or [""])[0])
    family = re.sub(r"\d+", "", n.get("family", ""))
    full = f"{given} {family}".strip()
    return full or "Unknown patient"


def _age(birth: str | None) -> int:
    if not birth:
        return 0
    try:
        b = date.fromisoformat(birth[:10])
        t = date.today()
        return t.year - b.year - ((t.month, t.day) < (b.month, b.day))
    except ValueError:
        return 0


def _mrn(patient: dict) -> str:
    for ident in patient.get("identifier", []):
        val = ident.get("value")
        types = code_text(ident.get("type"))
        if val and ("Medical Record" in types or "MR" in types):
            return val
    ids = patient.get("identifier") or []
    if ids and ids[0].get("value"):
        return ids[0]["value"][:12]
    return f"ID-{patient.get('id', '?')}"


def _conditions(fhir: FhirClient, pid: str) -> list[str]:
    out = []
    for c in fhir.search("Condition", {"patient": pid, "clinical-status": "active", "_count": "20"}):
        t = code_text(c.get("code"))
        if t and t not in out:
            out.append(t)
    return out[:4]


def _medications(fhir: FhirClient, pid: str) -> list[str]:
    out = []
    for m in fhir.search("MedicationRequest", {"patient": pid, "status": "active", "_count": "20"}):
        t = code_text(m.get("medicationCodeableConcept")) or code_text(
            (m.get("medicationReference") or {})
        )
        if not t and m.get("medicationReference", {}).get("display"):
            t = m["medicationReference"]["display"]
        if t and t not in out:
            out.append(t)
    return out[:4]


def _last_seen(fhir: FhirClient, pid: str) -> str:
    enc = fhir.search("Encounter", {"patient": pid, "_sort": "-date", "_count": "1"})
    if not enc:
        return "—"
    period = enc[0].get("period") or {}
    start = period.get("start")
    if not start:
        return "—"
    try:
        return datetime.fromisoformat(start.replace("Z", "+00:00")).strftime("%b %d, %Y")
    except ValueError:
        return start[:10]
