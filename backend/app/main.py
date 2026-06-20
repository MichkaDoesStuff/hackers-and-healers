"""Loop backend API. Serves the risk-ranked worklist the ClinicOS panel renders."""
from __future__ import annotations

import os

import httpx
from fastapi import Body, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import llm, triage
from .appointments import (
    appointment_ics,
    book_appointment,
    get_appointment,
    get_availability,
    list_appointments,
    offered_slots,
)
from .cds_followup import create_followup_review_task
from .clinic import build_clinic
from .config import CORS_ORIGINS
from .detectors import detect_all
from .fhir import FhirClient
from .models import Loop
from .phone import (
    configured as twilio_configured,
    gather_twiml,
    get_call_context,
    place_appointment_call,
    say_hangup_twiml,
)
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


class CallReq(BaseModel):
    to_number: str                         # E.164, e.g. +14165551234
    script: str | None = None              # opening line drafted upstream
    purpose: str = "Schedule a follow-up appointment"
    patient_name: str | None = None
    auto_book: bool = True                 # demo: simulate a booked slot in one pass


class BookReq(BaseModel):
    patient_id: str
    patient_name: str | None = None
    start: str                             # ISO 8601
    end: str | None = None
    reason: str = "Follow-up appointment"
    loop_id: str | None = None
    practitioner: str | None = None

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
    return {"status": "ok", "fhir": fhir.metadata_ok(), "twilio": twilio_configured()}


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


# --------------------- AI phone call + appointment booking ------------------- #
@app.post("/api/loops/{loop_id}/call")
def call_patient(loop_id: str, req: CallReq):
    """Place an outbound AI call (Twilio) to book the patient's appointment.

    Live: returns immediately with status "calling"; the TwiML voice flow books the
    slot the patient chooses during the call (/api/voice/handle).
    Demo (no Twilio config): the call is simulated and — when auto_book is on — the
    first open slot is booked right away so the loop visibly closes in one pass.
    """
    fhir = get_fhir()
    loop = find_loop(fhir, loop_id)
    if not loop:
        raise HTTPException(status_code=404, detail="loop not found")

    patient_name = req.patient_name or loop.patient_name
    call = place_appointment_call(
        to_number=req.to_number,
        patient_name=patient_name,
        purpose=req.purpose,
        script=req.script,
        loop=loop,
    )

    appointment = None
    if call.get("demo") and req.auto_book:
        slots = offered_slots()
        if slots:
            slot = slots[0]
            appointment = book_appointment(
                patient_id=loop.patient_id,
                patient_name=patient_name,
                start=slot["start"],
                end=slot["end"],
                reason=f"Follow-up: {loop.title}",
                loop=loop,
                source="phone-agent (simulated)",
                fhir=fhir,
            )

    return {"loop_id": loop_id, "call": call, "appointment": appointment}


@app.get("/api/scheduling/availability")
def scheduling_availability(days: int = 5):
    """Open slots the phone agent (and the UI) can offer the patient."""
    return {"slots": get_availability(days=days)}


@app.post("/api/scheduling/book")
def scheduling_book(req: BookReq):
    """Lock a slot + update the calendar. Called by the AI agent's booking tool
    mid-call, or directly from the UI."""
    fhir = get_fhir()
    loop = find_loop(fhir, req.loop_id) if req.loop_id else None
    name = req.patient_name or (loop.patient_name if loop else "Patient")
    return book_appointment(
        patient_id=req.patient_id,
        patient_name=name,
        start=req.start,
        end=req.end,
        reason=req.reason,
        practitioner=req.practitioner,
        loop=loop,
        source="phone-agent",
        fhir=fhir,
    )


@app.get("/api/appointments")
def appointments(patient: str | None = None, loop_id: str | None = None):
    """Booked appointments (the custom-calendar store)."""
    return {"appointments": list_appointments(patient, loop_id)}


@app.get("/api/appointments/{appt_id}/ics")
def appointment_ics_route(appt_id: str):
    """Download a booked visit as an .ics — drops into any calendar app."""
    appt = get_appointment(appt_id)
    if not appt:
        raise HTTPException(status_code=404, detail="appointment not found")
    return Response(
        content=appointment_ics(appt),
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="{appt_id}.ics"'},
    )


# ----------------------- Twilio voice (TwiML webhooks) ---------------------- #
def _choice_to_index(digits: str | None, speech: str | None, n: int) -> int | None:
    """Map the patient's keypad/spoken choice to a slot index (0-based), or None.

    Tokenizes speech and checks ordinals before cardinals so "the second one"
    resolves to slot 2, not slot 1 (the bare "one" inside it).
    """
    if digits and digits.isdigit():
        d = int(digits)
        return d - 1 if 1 <= d <= n else None
    import re

    tokens = set(re.findall(r"[a-z]+", (speech or "").lower()))
    for ladder in (["first", "second", "third"], ["one", "two", "three"]):
        for i in range(min(n, len(ladder))):
            if ladder[i] in tokens:
                return i
    return None


async def _twilio_form(request: Request) -> dict:
    """Parse Twilio's application/x-www-form-urlencoded callback (no extra deps)."""
    from urllib.parse import parse_qs

    try:
        body = (await request.body()).decode()
    except Exception:  # noqa: BLE001
        return {}
    return {k: v[0] for k, v in parse_qs(body).items()}


@app.post("/api/voice/answer")
async def voice_answer(request: Request):
    """TwiML Twilio fetches when the patient picks up — greet + offer slots."""
    ctx = request.query_params.get("ctx", "")
    context = get_call_context(ctx) or {}
    name = context.get("patient_name") or "there"
    greeting = context.get("greeting") or (
        f"Hello {name}, this is your clinic's scheduling assistant calling to "
        "book a follow-up appointment."
    )
    slots = offered_slots(3)
    if not slots:
        return Response(
            say_hangup_twiml("We couldn't find an open time right now. We'll call you back. Goodbye."),
            media_type="application/xml",
        )
    offer = " ".join(f"Press {i + 1} for {s['label']}." for i, s in enumerate(slots))
    prompt = f"{greeting} {offer} Or press 0 to ask for another time."
    return Response(
        gather_twiml(
            prompt,
            action=f"/api/voice/handle?ctx={ctx}",
            reprompt="Sorry, we didn't catch that. Our office will call you back. Goodbye.",
        ),
        media_type="application/xml",
    )


@app.post("/api/voice/handle")
async def voice_handle(request: Request):
    """Process the patient's choice, book the slot, and confirm."""
    ctx = request.query_params.get("ctx", "")
    form = await _twilio_form(request)
    context = get_call_context(ctx) or {}
    slots = offered_slots(3)
    idx = _choice_to_index(form.get("Digits"), form.get("SpeechResult"), len(slots))
    if idx is None:
        return Response(
            say_hangup_twiml("No problem. Our office will call you back to find a time. Goodbye."),
            media_type="application/xml",
        )
    slot = slots[idx]
    fhir = get_fhir()
    loop = find_loop(fhir, context["loop_id"]) if context.get("loop_id") else None
    book_appointment(
        patient_id=context.get("patient_id") or "unknown",
        patient_name=context.get("patient_name") or "Patient",
        start=slot["start"],
        end=slot["end"],
        reason=context.get("reason") or "Follow-up appointment",
        loop=loop,
        source="phone-agent (twilio)",
        fhir=fhir,
    )
    return Response(
        say_hangup_twiml(
            f"Great. You're booked for {slot['label']}. You'll get a confirmation shortly. Goodbye."
        ),
        media_type="application/xml",
    )


@app.post("/api/voice/status")
async def voice_status(request: Request):
    """Twilio status callback (ringing / answered / completed). Ack only."""
    form = await _twilio_form(request)
    return {"received": True, "call_sid": form.get("CallSid"), "status": form.get("CallStatus")}
