"""CDS Hooks suggestion → FHIR Task write-back (with local demo fallback)."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .fhir import FhirClient
from .models import Loop

_TASKS_PATH = Path(__file__).resolve().parents[2] / "data" / "cds_tasks.json"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _record_demo_task(
    task_id: str,
    patient_id: str,
    description: str,
    loop: Loop | None,
    user_id: str | None,
) -> None:
    _TASKS_PATH.parent.mkdir(parents=True, exist_ok=True)
    rows: list[dict] = []
    if _TASKS_PATH.exists():
        try:
            rows = json.loads(_TASKS_PATH.read_text())
        except (json.JSONDecodeError, ValueError):
            rows = []
    rows.append({
        "task_id": task_id,
        "patient_id": patient_id,
        "description": description,
        "loop_id": loop.id if loop else None,
        "user_id": user_id,
        "created_at": _now(),
        "demo": True,
    })
    _TASKS_PATH.write_text(json.dumps(rows[-50:], indent=2))


def create_followup_review_task(
    fhir: FhirClient,
    patient_id: str,
    *,
    loop: Loop | None = None,
    user_id: str | None = None,
) -> dict:
    """Create a Task when the clinician accepts the CDS suggestion."""
    pid = patient_id.replace("Patient/", "")
    description = "Follow-up review task created from LoHop CDS Hooks suggestion."
    code = "Follow-up review (CDS Hooks)"

    if loop:
        description = f"Follow-up review for open loop: {loop.title}. {loop.subtitle}"
        code = f"Loop follow-up: {loop.title}"

    task_body: dict = {
        "resourceType": "Task",
        "status": "requested",
        "intent": "order",
        "authoredOn": _now(),
        "code": {"text": code},
        "description": description[:1000],
        "for": {"reference": f"Patient/{pid}"},
    }

    if loop and loop.focus:
        focus = loop.focus[0]
        task_body["focus"] = {"reference": f"{focus.resourceType}/{focus.id}"}

    if user_id:
        task_body["owner"] = {"reference": user_id if "/" in user_id else f"Practitioner/{user_id}"}

    try:
        task = fhir.create(task_body)
        prov = fhir.create({
            "resourceType": "Provenance",
            "target": [{"reference": f"Task/{task['id']}"}],
            "recorded": _now(),
            "activity": {"coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/v3-DataOperation",
                "code": "CREATE",
            }]},
            "agent": [{
                "type": {"coding": [{"code": "author"}]},
                "who": {"display": user_id or "Clinician"},
            }],
        })
        return {
            "status": "created",
            "task_id": task["id"],
            "provenance_id": prov["id"],
            "loop_id": loop.id if loop else None,
            "demo": False,
        }
    except Exception as exc:
        task_id = f"lohop-{uuid.uuid4().hex[:8]}"
        _record_demo_task(task_id, pid, description, loop, user_id)
        return {
            "status": "created",
            "task_id": task_id,
            "provenance_id": None,
            "loop_id": loop.id if loop else None,
            "demo": True,
            "note": f"FHIR server read-only; task recorded locally ({exc}).",
        }
