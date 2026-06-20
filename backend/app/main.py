"""Loop backend API. Serves the risk-ranked worklist the ClinicOS panel renders."""
from __future__ import annotations

import os

import httpx
from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import llm, triage
from .cds_followup import create_followup_review_task
from .clinic import build_clinic
from .config import CORS_ORIGINS
from .detectors import detect_all
from .fhir import FhirClient
from .models import Loop
from .playbooks import (
    Playbook,
    delete_playbook,
    get_playbook,
    list_playbooks,
    save_playbook,
)
from .reports import build_reports
from .risk import rank
from .writeback import build_context, find_loop, write_action

# default drafting prompt per loop type (used when no playbook prompt is supplied)
DEFAULT_PROMPTS = {
    "abnormal_result": "Draft a short message to the family physician about this abnormal result: what it is, why it matters, and the next action. Non-alarming, no diagnosis.",
    "ordered_not_resulted": "Draft a short note to chase this overdue test result and inform the ordering clinician.",
    "referral_no_response": "Draft a short message nudging the specialist about this unanswered referral and what's needed.",
    "billing_unreconciled": "Draft a billing-ready summary to resubmit the rejected claim lines before the deadline.",
}


def _prompt_for(loop: Loop, playbook_id: str | None) -> str:
    if playbook_id:
        pb = get_playbook(playbook_id)
        if pb:
            for step in pb.steps:
                if step.kind == "draft" and step.prompt:
                    return step.prompt
    return DEFAULT_PROMPTS.get(loop.type, "Draft a short clinician follow-up for this open loop.")


class DraftReq(BaseModel):
    playbook_id: str | None = None


class ApproveReq(BaseModel):
    playbook_id: str | None = None
    message: str | None = None       # clinician-edited text overrides the draft
    approver: str = "Clinician"


class CdsFollowupReq(BaseModel):
    patient_id: str
    user_id: str | None = None

app = FastAPI(title="Loop API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_fhir() -> FhirClient:
    return FhirClient()


@app.get("/health")
def health():
    fhir = get_fhir()
    return {"status": "ok", "fhir": fhir.metadata_ok()}


@app.get("/api/loops")
def list_loops(patient: str | None = None):
    """The worklist: detect open loops, risk-rank, return cards for the panel.

    With ?patient=<id> (the SMART launch patient context), scope to that chart.
    Without it, return the whole-population worklist (the morning sweep).
    """
    fhir = get_fhir()
    loops = rank(detect_all(fhir))
    patient_name = None
    if patient:
        loops = [l for l in loops if l.patient_id == patient]
        if loops:
            patient_name = loops[0].patient_name
    return {
        "open": len(loops),
        "patient": patient,
        "patient_name": patient_name,
        "loops": [l.model_dump() for l in loops],
    }


@app.get("/api/clinic")
def clinic():
    """Patients + issues in the frontend's shape, from live FHIR detection."""
    fhir = get_fhir()
    patients = build_clinic(fhir)
    issues = sum(len(p["issues"]) for p in patients)
    return {"patients": patients, "open": issues}


# ----------------------------- playbooks ----------------------------------- #
@app.get("/api/playbooks")
def playbooks(loop_type: str | None = None):
    """Prebuilt library + user-defined playbooks. Filter by loop_type to reuse."""
    return {"playbooks": [p.model_dump() for p in list_playbooks(loop_type)]}


@app.get("/api/playbooks/{pid}")
def playbook(pid: str):
    pb = get_playbook(pid)
    if not pb:
        raise HTTPException(status_code=404, detail="playbook not found")
    return pb.model_dump()


@app.post("/api/playbooks")
def create_playbook(pb: Playbook):
    """Define / save a reusable workflow (builtins are copied, never overwritten)."""
    return save_playbook(pb).model_dump()


@app.delete("/api/playbooks/{pid}")
def remove_playbook(pid: str):
    return {"deleted": delete_playbook(pid)}


# ------------------------------- reports ----------------------------------- #
@app.get("/api/reports")
def reports():
    """Impact (money + time recovered), detection accuracy, and run cost."""
    return build_reports(get_fhir())


# --------------------------- CDS Hooks actions ------------------------------- #
@app.post("/api/cds/followup-task")
def cds_followup_task(req: CdsFollowupReq):
    """Create a FHIR Task when the clinician accepts a CDS card suggestion."""
    fhir = get_fhir()
    pid = req.patient_id.replace("Patient/", "")
    loops = [l for l in rank(detect_all(fhir)) if l.patient_id == pid]
    top_loop = loops[0] if loops else None
    try:
        return create_followup_review_task(fhir, pid, loop=top_loop, user_id=req.user_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# --------------------------- draft + approve ------------------------------- #
@app.post("/api/loops/{loop_id}/draft")
def draft_loop(loop_id: str, req: DraftReq = Body(default=DraftReq())):
    """Generate the action draft (LLM or fallback). No write — preview only."""
    fhir = get_fhir()
    loop = find_loop(fhir, loop_id)
    if not loop:
        raise HTTPException(status_code=404, detail="loop not found")
    result = llm.draft(_prompt_for(loop, req.playbook_id), build_context(loop))
    return {"loop_id": loop_id, "model": result["model"], "draft": result["text"]}


@app.post("/api/loops/{loop_id}/approve")
def approve_loop(loop_id: str, req: ApproveReq = Body(default=ApproveReq())):
    """Approve a loop: draft (if not provided), write Task + CommunicationRequest +
    Provenance to FHIR, and report whether the loop is now closed."""
    fhir = get_fhir()
    loop = find_loop(fhir, loop_id)
    if not loop:
        raise HTTPException(status_code=404, detail="loop not found")
    message = req.message
    model = "clinician-edited"
    if not message:
        d = llm.draft(_prompt_for(loop, req.playbook_id), build_context(loop))
        message, model = d["text"], d["model"]
    result = write_action(fhir, loop, message, req.approver)
    closed = find_loop(fhir, loop_id) is None
    return {**result, "loop_id": loop_id, "closed": closed, "model": model, "message": message}


# ------------------------------ fax triage --------------------------------- #
# Unstructured incoming fax -> LLM-extracted structured referral -> clinician
# review -> approve writes a real FHIR ServiceRequest + Provenance.
@app.post("/api/triage/scan")
def triage_scan(patient: str | None = None):
    """Simulate receiving a referral fax (for a patient, or auto-pick one), extract it."""
    task = triage.scan_patient(get_fhir(), patient)
    if not task:
        raise HTTPException(status_code=404, detail="no patient available to scan")
    return task


@app.get("/api/triage/tasks")
def triage_tasks():
    return {"tasks": triage.list_tasks()}


@app.get("/api/triage/tasks/{task_id}")
def triage_task(task_id: str):
    task = triage.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="task not found")
    return task


@app.post("/api/triage/tasks/{task_id}/approve")
def triage_approve(task_id: str, req: ApproveReq = Body(default=ApproveReq())):
    """Approve the extracted referral: write ServiceRequest + Provenance to FHIR."""
    result = triage.approve(get_fhir(), task_id, req.approver)
    if not result:
        raise HTTPException(status_code=404, detail="task not found")
    return result


class SmsReq(BaseModel):
    to: str
    body: str


@app.post("/api/notify/sms")
def notify_sms(req: SmsReq):
    """Send an SMS via Twilio. Simulated unless TWILIO_* creds are set."""
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_ = os.environ.get("TWILIO_FROM")
    if not (sid and token and from_):
        return {
            "sent": True,
            "simulated": True,
            "to": req.to,
            "body": req.body,
            "note": "simulated — set TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM to send real SMS",
        }
    try:
        resp = httpx.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
            auth=(sid, token),
            data={"From": from_, "To": req.to, "Body": req.body},
            timeout=10.0,
        )
        resp.raise_for_status()
        return {
            "sent": True,
            "simulated": False,
            "sid": resp.json().get("sid"),
            "to": req.to,
        }
    except Exception as e:  # noqa: BLE001 — never raise Twilio/network errors to the client
        return {"sent": False, "error": str(e)}
