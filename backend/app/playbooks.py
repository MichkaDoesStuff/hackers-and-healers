"""Playbooks: define reusable clinical workflows, store user-defined ones, and ship
a prebuilt library. Steps use the frontend's StepKind vocabulary so the UI renders
them directly. Each playbook is keyed to a loop_type so it can be reused/attached
to any matching open loop.
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path

from pydantic import BaseModel, Field

STORE_PATH = Path(__file__).resolve().parents[2] / "data" / "playbooks_store.json"

# clinical-action kinds carry a non-removable approval gate at run time — these
# touch the outside world (chart, lab, the patient's phone, the calendar).
GATED_KINDS = {"order", "notify", "call", "book", "calendar"}


class Step(BaseModel):
    id: str
    kind: str            # trigger | detect | draft | order | notify | decision | resolve
    title: str
    detail: str = ""
    actor: str = "Loop"
    prompt: str | None = None   # editable instruction for AI steps (draft/detect)
    gated: bool = False
    x: int = 0
    y: int = 0


class Edge(BaseModel):
    source: str
    target: str
    label: str | None = None


class Playbook(BaseModel):
    id: str
    title: str
    description: str = ""
    loop_type: str       # which loop this playbook handles (the trigger)
    version: int = 1
    builtin: bool = False
    steps: list[Step] = Field(default_factory=list)
    edges: list[Edge] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Prebuilt library — "already defined workflows they can just use"
# --------------------------------------------------------------------------- #
def _chain(*ids: str) -> list[Edge]:
    return [Edge(source=a, target=b) for a, b in zip(ids, ids[1:])]


def _gate(kind: str) -> bool:
    return kind in GATED_KINDS


def _steps(rows: list[tuple]) -> list[Step]:
    # row = (id, kind, title, detail, actor, prompt, x, y)
    return [
        Step(id=r[0], kind=r[1], title=r[2], detail=r[3], actor=r[4], prompt=r[5],
             gated=_gate(r[1]), x=r[6], y=r[7])
        for r in rows
    ]


LIBRARY: list[Playbook] = [
    Playbook(
        id="pb-critical-lab-recall",
        title="Critical lab recall",
        description="Un-acknowledged critical/abnormal result: draft recall, suggest repeat, book review.",
        loop_type="abnormal_result",
        builtin=True,
        steps=_steps([
            ("t", "trigger", "patient-view fired", "Chart opened / loop detected", "EHR", None, 0, 120),
            ("d", "detect", "Critical result detected", "Lab value crosses safety threshold, unreviewed", "Loop", None, 280, 120),
            ("ai", "draft", "Draft clinician message", "Claude drafts summary + recommended action", "Loop AI",
             "Draft a short message to the patient's family physician about an abnormal lab result. Summarize the result, why it matters given the patient's active meds and problems, and the next action. Specific, non-alarming, no diagnosis. 3-4 sentences.", 560, 0),
            ("o", "order", "Suggest repeat lab", "Pre-fill order for confirmatory recheck", "Loop", None, 560, 240),
            ("rev", "decision", "Clinician reviews", "Accept, adjust, or dismiss", "Clinician", None, 840, 120),
            ("res", "resolve", "Loop closed", "Acknowledgment written back to chart", "Loop", None, 1120, 120),
        ]),
        edges=_chain("t", "d", "ai", "rev", "res") + [Edge(source="d", target="o"), Edge(source="o", target="rev")],
    ),
    Playbook(
        id="pb-result-published-followup",
        title="Result-published follow-up",
        description="Ordered test with no result: chase the lab, notify the ordering clinician.",
        loop_type="ordered_not_resulted",
        builtin=True,
        steps=_steps([
            ("t", "trigger", "Order placed", "Lab/imaging ordered", "EHR", None, 0, 100),
            ("d", "detect", "Result overdue", "No result past expected turnaround", "Loop", None, 280, 100),
            ("n", "notify", "Chase the lab", "Secure message to the performing lab", "Loop", None, 560, 100),
            ("rev", "decision", "Result returned?", "Branch on whether the result arrives", "Clinician", None, 840, 100),
            ("res", "resolve", "Loop closed", "Result filed / acknowledged", "Loop", None, 1120, 100),
        ]),
        edges=_chain("t", "d", "n", "rev", "res"),
    ),
    Playbook(
        id="pb-referral-chase",
        title="Referral chase",
        description="Referral with no reply: nudge the specialist, track until booked.",
        loop_type="referral_no_response",
        builtin=True,
        steps=_steps([
            ("t", "trigger", "Referral sent", "Referral placed", "EHR", None, 0, 100),
            ("d", "detect", "Referral unanswered", "No acknowledgment from receiving practice", "Loop", None, 280, 100),
            ("n", "notify", "Nudge specialist", "Secure message to specialist intake", "Loop", None, 560, 100),
            ("rev", "decision", "Reply received?", "Branch on specialist response", "Clinician", None, 840, 100),
            ("res", "resolve", "Appointment booked", "Loop closed, visit scheduled", "Loop", None, 1120, 100),
        ]),
        edges=_chain("t", "d", "n", "rev", "res"),
    ),
    Playbook(
        id="pb-appointment-booking",
        title="AI patient callback & booking",
        description="Call the patient with an AI voice agent (Twilio), book the slot they choose, update the clinic calendar, and write the visit back to the chart.",
        loop_type="referral_no_response",
        builtin=True,
        steps=_steps([
            ("t", "trigger", "Outreach due", "Referral/follow-up overdue — the patient needs a visit", "Loop", None, 0, 100),
            ("d", "detect", "Rank & gather", "Confirm urgency, pull the patient's phone number", "Loop", None, 280, 100),
            ("ai", "draft", "Draft call script", "Claude drafts what the agent should say and ask", "Loop AI",
             "Write a short, warm phone-call opening for an AI scheduling agent calling a patient on behalf of their clinic to book an overdue follow-up appointment. State who is calling and why, then ask which day/time works best. 2-3 sentences, plain spoken language, reassuring, no medical advice or diagnosis.", 560, 100),
            ("call", "call", "AI calls patient", "Twilio voice agent phones the patient and offers open slots", "Phone agent", None, 840, 100),
            ("book", "book", "Book chosen slot", "Store the slot the patient picked (the appointment record)", "Loop", None, 1120, 100),
            ("cal", "calendar", "Update calendar", "Add the visit to the clinic / Google calendar", "Loop", None, 1400, 100),
            ("rev", "decision", "Clinician confirms", "Review the booked visit before closing", "Clinician", None, 1680, 100),
            ("res", "resolve", "Loop closed", "Appointment booked, note written to chart", "Loop", None, 1960, 100),
        ]),
        edges=_chain("t", "d", "ai", "call", "book", "cal", "rev", "res"),
    ),
    Playbook(
        id="pb-billing-reconciliation",
        title="Billing reconciliation",
        description="Rejected/un-reconciled claim lines: draft the correction, resubmit before the deadline.",
        loop_type="billing_unreconciled",
        builtin=True,
        steps=_steps([
            ("t", "trigger", "Claim batch posted", "Batch returns from clearinghouse", "EHR", None, 0, 100),
            ("d", "detect", "Rejections flagged", "Lines rejected, dollars at risk", "Loop", None, 280, 100),
            ("ai", "draft", "Draft correction", "Fix each rejected line (e.g. add prior-auth modifier)", "Loop AI",
             "Draft a corrected claim resubmission for the rejected lines. State the rejection reason, the fix, and the timely-filing deadline. Billing-ready summary.", 560, 100),
            ("rev", "decision", "Biller approves", "Review proposed resubmission", "Billing", None, 840, 100),
            ("res", "resolve", "Resubmit before deadline", "Loop closed inside filing window", "Loop", None, 1120, 100),
        ]),
        edges=_chain("t", "d", "ai", "rev", "res"),
    ),
]

_LIBRARY_BY_ID = {p.id: p for p in LIBRARY}


# --------------------------------------------------------------------------- #
# User-defined store (JSON file)
# --------------------------------------------------------------------------- #
def _load_store() -> dict[str, Playbook]:
    if not STORE_PATH.exists():
        return {}
    try:
        raw = json.loads(STORE_PATH.read_text())
        return {pid: Playbook(**pb) for pid, pb in raw.items()}
    except (json.JSONDecodeError, ValueError):
        return {}


def _save_store(store: dict[str, Playbook]) -> None:
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STORE_PATH.write_text(json.dumps({pid: pb.model_dump() for pid, pb in store.items()}, indent=2))


def list_playbooks(loop_type: str | None = None) -> list[Playbook]:
    """Builtin library + user-defined, optionally filtered to a loop type (for reuse)."""
    out = list(LIBRARY) + list(_load_store().values())
    if loop_type:
        out = [p for p in out if p.loop_type == loop_type]
    return out


def get_playbook(pid: str) -> Playbook | None:
    if pid in _LIBRARY_BY_ID:
        return _LIBRARY_BY_ID[pid]
    return _load_store().get(pid)


def save_playbook(pb: Playbook) -> Playbook:
    """Create or update a user-defined playbook. Builtins are copied, never overwritten."""
    store = _load_store()
    if not pb.id or pb.id in _LIBRARY_BY_ID:
        pb = pb.model_copy(update={"id": f"pb-{uuid.uuid4().hex[:8]}", "builtin": False})
    else:
        pb = pb.model_copy(update={"builtin": False, "version": pb.version + 1})
    store[pb.id] = pb
    _save_store(store)
    return pb


def delete_playbook(pid: str) -> bool:
    store = _load_store()
    if pid in store:
        del store[pid]
        _save_store(store)
        return True
    return False
