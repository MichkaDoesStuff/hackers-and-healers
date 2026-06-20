"""Write-back: turn an approved loop into real FHIR resources, with provenance.

Only called after a clinician approves. Writing a Task whose `focus` is the loop's
focus resource also CLOSES the loop (the detectors treat a referencing Task as the
acknowledgement), so the safety net visibly resolves.
"""
from __future__ import annotations

from datetime import datetime, timezone

from . import state
from .detectors import _actioned_focuses, detect_all
from .fhir import FhirClient
from .models import Loop
from .risk import rank


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def find_loop(fhir: FhirClient, loop_id: str) -> Loop | None:
    for loop in rank(detect_all(fhir)):
        if loop.id == loop_id:
            return loop
    return None


def build_context(loop: Loop) -> str:
    return (
        f"Patient: {loop.patient_name}\n"
        f"Finding: {loop.title}\n"
        f"Status: {loop.subtitle}\n"
        f"Why flagged: {'; '.join(loop.why)}"
    )


def already_actioned(fhir: FhirClient, loop: Loop) -> bool:
    if not loop.focus:
        return False
    f = loop.focus[0]
    return f"{f.resourceType}/{f.id}" in _actioned_focuses(fhir)


def write_action(fhir: FhirClient, loop: Loop, message: str, approver: str = "Clinician") -> dict:
    """Create Task + CommunicationRequest + Provenance. Idempotent on the loop focus."""
    if already_actioned(fhir, loop):
        return {"status": "already_actioned", "written": []}

    focus = loop.focus[0] if loop.focus else None
    patient_ref = {"reference": f"Patient/{loop.patient_id}"} if loop.patient_id else None

    task_body = {
        "resourceType": "Task",
        "status": "requested",
        "intent": "order",
        "authoredOn": _now(),
        "code": {"text": f"Loop follow-up: {loop.title}"},
        "description": message[:1000],
    }
    if patient_ref:
        task_body["for"] = patient_ref
    if focus:
        task_body["focus"] = {"reference": f"{focus.resourceType}/{focus.id}"}
    task = fhir.create(task_body)

    comm_body = {
        "resourceType": "CommunicationRequest",
        "status": "active",
        "payload": [{"contentString": message}],
    }
    if patient_ref:
        comm_body["subject"] = patient_ref
    comm = fhir.create(comm_body)

    prov = fhir.create({
        "resourceType": "Provenance",
        "target": [
            {"reference": f"Task/{task['id']}"},
            {"reference": f"CommunicationRequest/{comm['id']}"},
        ],
        "recorded": _now(),
        "activity": {"coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/v3-DataOperation",
            "code": "CREATE"}]},
        "agent": [
            {"type": {"coding": [{"code": "assembler"}]},
             "who": {"display": "Loop (automated safety net)"}},
            {"type": {"coding": [{"code": "author"}]},
             "who": {"display": approver}},
        ],
    })

    # Record in Loop's own store so the loop closes immediately (FHIR search lags).
    if focus:
        state.mark_actioned([f"{focus.resourceType}/{focus.id}"])

    return {
        "status": "actioned",
        "written": [
            {"resourceType": "Task", "id": task["id"]},
            {"resourceType": "CommunicationRequest", "id": comm["id"]},
            {"resourceType": "Provenance", "id": prov["id"]},
        ],
    }
