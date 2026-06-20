"""Outbound AI phone call via Twilio Programmable Voice, with a local demo
fallback so the loop runs end-to-end without telephony.

Twilio is just the phone line — the "AI agent" conversation is driven by TwiML
that our backend serves: when the patient answers, Twilio fetches /api/voice/answer
(greeting + offered slots), and the patient's choice posts to /api/voice/handle,
which books the slot and confirms. Per-call context (which patient/loop/slots) is
keyed by an opaque token passed through the webhook URLs.

With no Twilio SID/token/number — or no PUBLIC_BASE_URL for Twilio to reach the
webhooks — the call is *simulated* and logged to data/calls.json so the rest of
the loop (book -> calendar -> close) still demonstrates.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx

from .config import (
    PUBLIC_BASE_URL,
    TWILIO_ACCOUNT_SID,
    TWILIO_API_BASE,
    TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER,
)
from .models import Loop

_CALLS_PATH = Path(__file__).resolve().parents[2] / "data" / "calls.json"
_CTX_PATH = Path(__file__).resolve().parents[2] / "data" / "call_ctx.json"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def configured() -> bool:
    """True only when Twilio can actually place a call (account + token + number)."""
    return bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER)


# --------------------------------------------------------------------------- #
# Per-call context store (keyed by an opaque token in the webhook URL)
# --------------------------------------------------------------------------- #
def save_call_context(token: str, ctx: dict) -> None:
    _CTX_PATH.parent.mkdir(parents=True, exist_ok=True)
    data: dict = {}
    if _CTX_PATH.exists():
        try:
            data = json.loads(_CTX_PATH.read_text())
        except (json.JSONDecodeError, ValueError):
            data = {}
    data[token] = ctx
    if len(data) > 100:  # keep the store bounded
        for stale in list(data.keys())[:-100]:
            del data[stale]
    _CTX_PATH.write_text(json.dumps(data, indent=2))


def get_call_context(token: str) -> dict | None:
    if not token or not _CTX_PATH.exists():
        return None
    try:
        return json.loads(_CTX_PATH.read_text()).get(token)
    except (json.JSONDecodeError, ValueError):
        return None


# --------------------------------------------------------------------------- #
# TwiML helpers (the spoken conversation)
# --------------------------------------------------------------------------- #
def _esc(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def gather_twiml(prompt: str, action: str, reprompt: str = "Goodbye.") -> str:
    """Speak `prompt`, collect one DTMF digit or speech, POST to `action`."""
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response>"
        f'<Gather input="dtmf speech" numDigits="1" timeout="6" speechTimeout="auto" '
        f'action="{_esc(action)}" method="POST">'
        f"<Say>{_esc(prompt)}</Say>"
        "</Gather>"
        f"<Say>{_esc(reprompt)}</Say><Hangup/>"
        "</Response>"
    )


def say_hangup_twiml(text: str) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f"<Response><Say>{_esc(text)}</Say><Hangup/></Response>"
    )


# --------------------------------------------------------------------------- #
# Place the outbound call
# --------------------------------------------------------------------------- #
def _record_call(row: dict) -> None:
    _CALLS_PATH.parent.mkdir(parents=True, exist_ok=True)
    rows: list[dict] = []
    if _CALLS_PATH.exists():
        try:
            rows = json.loads(_CALLS_PATH.read_text())
        except (json.JSONDecodeError, ValueError):
            rows = []
    rows.append(row)
    _CALLS_PATH.write_text(json.dumps(rows[-50:], indent=2))


def place_appointment_call(
    *,
    to_number: str,
    patient_name: str,
    purpose: str = "Schedule a follow-up appointment",
    script: str | None = None,
    loop: Loop | None = None,
) -> dict:
    """Start an outbound Twilio call to book an appointment.

    Returns {status, call_id, demo, ...}. `status` is "calling" when Twilio accepts
    the request (the booking lands later when the patient picks a slot on the call),
    "simulated" in demo mode, or "failed" on an API error.
    """
    token = uuid.uuid4().hex
    reason = f"Follow-up: {loop.title}" if loop else purpose
    save_call_context(token, {
        "loop_id": loop.id if loop else None,
        "patient_id": loop.patient_id if loop else None,
        "patient_name": patient_name,
        "reason": reason,
        "greeting": script,
    })

    base = {
        "to_number": to_number,
        "patient_name": patient_name,
        "purpose": purpose,
        "loop_id": loop.id if loop else None,
        "ctx": token,
        "created_at": _now(),
    }

    # --- demo fallback: no usable Twilio config / no public webhook URL -------
    if not configured() or not PUBLIC_BASE_URL:
        why = "Twilio not fully configured" if not configured() else "PUBLIC_BASE_URL not set"
        row = {
            **base,
            "call_id": f"call-demo-{uuid.uuid4().hex[:8]}",
            "conversation_id": None,
            "status": "simulated",
            "demo": True,
        }
        _record_call(row)
        return {**row, "note": f"{why}; call simulated locally."}

    # --- live: Twilio outbound voice call pointed at our TwiML webhook --------
    answer_url = f"{PUBLIC_BASE_URL}/api/voice/answer?ctx={token}"
    status_url = f"{PUBLIC_BASE_URL}/api/voice/status"
    try:
        r = httpx.post(
            f"{TWILIO_API_BASE}/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Calls.json",
            data={
                "To": to_number,
                "From": TWILIO_FROM_NUMBER,
                "Url": answer_url,
                "Method": "POST",
                "StatusCallback": status_url,
                "StatusCallbackEvent": "completed",
            },
            auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
            timeout=30.0,
        )
        r.raise_for_status()
        data = r.json()
    except Exception as exc:  # noqa: BLE001 — surface any failure as a logged row
        row = {
            **base,
            "call_id": f"call-err-{uuid.uuid4().hex[:8]}",
            "conversation_id": None,
            "status": "failed",
            "demo": False,
            "error": str(exc),
        }
        _record_call(row)
        return {**row, "note": f"Twilio call failed ({exc})."}

    row = {
        **base,
        "call_id": data.get("sid") or f"call-{uuid.uuid4().hex[:8]}",
        "conversation_id": data.get("sid"),
        "status": "calling",
        "demo": False,
    }
    _record_call(row)
    return {**row, "twilio_status": data.get("status")}
