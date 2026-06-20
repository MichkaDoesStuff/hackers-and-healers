"""Fax triage: turn an unstructured incoming referral fax into structured, reviewable
data — then, on clinician approval, write the referral back to FHIR with provenance.

This is the unstructured -> structured complement to Loop's structured detection.
Clean reimplementation of the prototype3 "Smart Triage" portal on Loop's own pluggable
LLM layer (Anthropic / Vertex / OpenAI / deterministic fallback). The LLM only reads
language into fields — it never sets urgency on its own authority, writes FHIR, or
skips the approval gate. Every write-back happens only after a clinician approves.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from . import llm
from .clinic import _age, _clean_name, _conditions
from .fhir import FhirClient

# In-memory task store (hackathon scope — mirrors the loop store's ephemerality).
TASKS: dict[str, dict] = {}

# condition keyword -> referred specialty (deterministic, inspectable)
_SPECIALTY_RULES = [
    (("hypertens", "cardi", "heart", "chest pain", "atrial", "failure"), "Cardiology"),
    (("ckd", "kidney", "renal", "nephro"), "Nephrology"),
    (("diab", "thyroid", "endocrin", "a1c"), "Endocrinology"),
    (("asthma", "copd", "respir", "pulmon", "dyspnoea", "dyspnea"), "Respirology"),
    (("cancer", "neoplasm", "tumor", "tumour", "malignan"), "Oncology"),
    (("seizure", "neuro", "stroke", "migraine"), "Neurology"),
]


def _specialist_for(condition: str) -> str:
    low = condition.lower()
    for keys, spec in _SPECIALTY_RULES:
        if any(k in low for k in keys):
            return spec
    return "Internal Medicine"


def _urgency_for(specialist: str) -> str:
    return "urgent" if specialist in ("Cardiology", "Nephrology", "Oncology") else "routine"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _demo_fax(name: str, age: int, sex: str, condition: str, specialist: str, urgency: str) -> str:
    when = "urgently" if urgency != "routine" else "at your earliest convenience"
    return (
        "FAX — CONFIDENTIAL — CENTRAL INTAKE\n"
        "From:  Dr. A. Okafor, Maple Family Practice  ·  Tel (416) 555-0148\n"
        "To:    Specialist Central Intake\n"
        "Pages: 1\n"
        "------------------------------------------------------------\n\n"
        f"Re: {name}    (Age {age}, {sex})\n\n"
        "Dear Colleague,\n\n"
        f"I am referring the above patient for {specialist} assessment. "
        f"The patient has a history of {condition}. Symptoms have progressed despite "
        "optimal management in the community, and I would value your opinion on next "
        "steps.\n\n"
        f"Please review {when}. The patient is aware of this referral and consents to "
        "the sharing of relevant chart information.\n\n"
        "Kind regards,\n"
        "Dr. A. Okafor, CCFP\n"
    )


def _pick_patient(fhir: FhirClient, exclude: set[str] | None = None) -> dict | None:
    """Prefer an unfaxed patient who has an active condition (so the fax has content)."""
    exclude = exclude or set()
    patients = fhir.search("Patient", {"_count": "20"})
    for p in patients:
        pid = p.get("id")
        if pid and pid not in exclude and _conditions(fhir, pid):
            return p
    for p in patients:  # fall back to any unfaxed patient
        if p.get("id") not in exclude:
            return p
    return patients[0] if patients else None


def scan_patient(fhir: FhirClient, patient_id: str | None = None) -> dict | None:
    """Simulate receiving a fax for a patient, extract structured fields, store a task."""
    used = {t["patientId"] for t in TASKS.values()}
    patient = (fhir.read("Patient", patient_id) if patient_id else None) or _pick_patient(fhir, used)
    if not patient:
        return None
    pid = patient.get("id", "")
    name = _clean_name(patient)
    age = _age(patient.get("birthDate"))
    sex = "F" if patient.get("gender") == "female" else "M"
    conditions = _conditions(fhir, pid)
    condition = conditions[0] if conditions else "an unspecified chronic condition"
    specialist = _specialist_for(condition)
    urgency = _urgency_for(specialist)

    fax_text = _demo_fax(name, age, sex, condition, specialist, urgency)

    # The LLM extracts from the fax text. With no key, fall back to the chart-derived
    # fields (deterministic, patient-specific) so the demo is clean offline.
    known = {
        "patient_name": name,
        "diagnosis": f"{condition} — progressive despite community management",
        "specialist": specialist,
        "urgency": urgency,
    }
    extraction = llm.extract_referral(fax_text)
    if extraction.get("model") == "fallback":
        extraction = {**known, "model": "fallback"}

    task_id = f"fax-{uuid.uuid4().hex[:6]}"
    task = {
        "taskId": task_id,
        "patientId": pid,
        "patientName": name,
        "faxText": fax_text,
        "extraction": extraction,
        "status": "pending",
        "createdAt": _now(),
    }
    TASKS[task_id] = task
    return task


def list_tasks() -> list[dict]:
    return sorted(TASKS.values(), key=lambda t: t.get("createdAt", ""), reverse=True)


def get_task(task_id: str) -> dict | None:
    return TASKS.get(task_id)


def approve(fhir: FhirClient, task_id: str, approver: str = "Clinician") -> dict | None:
    """Write the approved referral to FHIR (ServiceRequest + Provenance). Idempotent."""
    task = TASKS.get(task_id)
    if not task:
        return None
    if task.get("status") == "approved":
        return {"status": "already_actioned", "written": task.get("written", []),
                "taskId": task_id}

    ex = task["extraction"]
    pid = task["patientId"]
    sr_body = {
        "resourceType": "ServiceRequest",
        "status": "active",
        "intent": "order",
        "authoredOn": _now(),
        "code": {"text": f"Referral to {ex.get('specialist', 'Specialist')}"},
        "reasonCode": [{"text": ex.get("diagnosis", "")}],
        "priority": "urgent" if ex.get("urgency") in ("urgent", "emergent") else "routine",
    }
    if pid:
        sr_body["subject"] = {"reference": f"Patient/{pid}"}
    sr = fhir.create(sr_body)

    prov = fhir.create({
        "resourceType": "Provenance",
        "target": [{"reference": f"ServiceRequest/{sr['id']}"}],
        "recorded": _now(),
        "activity": {"coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/v3-DataOperation",
            "code": "CREATE"}]},
        "agent": [
            {"type": {"coding": [{"code": "assembler"}]},
             "who": {"display": "LoHop Smart Triage (fax extraction)"}},
            {"type": {"coding": [{"code": "author"}]},
             "who": {"display": approver}},
        ],
    })

    written = [
        {"resourceType": "ServiceRequest", "id": sr["id"]},
        {"resourceType": "Provenance", "id": prov["id"]},
    ]
    task["status"] = "approved"
    task["written"] = written
    return {"status": "actioned", "written": written, "taskId": task_id,
            "specialist": ex.get("specialist"), "approver": approver}
