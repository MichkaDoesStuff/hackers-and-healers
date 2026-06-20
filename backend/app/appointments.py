"""Booked-appointment store + calendar update.

The local JSON store (data/appointments.json) is the always-available "custom
calendar" and system of record for the demo. On top of it we optionally:
  - write a FHIR Appointment back to the EHR (records the visit in-chart), and
  - POST the event to a generic calendar webhook (CALENDAR_WEBHOOK_URL) — the
    integration point for Google Calendar / Outlook / a clinic scheduler.
Every appointment also exposes an .ics so it drops into any calendar app.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

from .config import CALENDAR_WEBHOOK_URL
from .fhir import FhirClient
from .models import Loop

_APPTS_PATH = Path(__file__).resolve().parents[2] / "data" / "appointments.json"
_SLOT_MINUTES = 30


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _label(iso: str) -> str:
    """Human-friendly slot label, e.g. 'Thu Jun 25, 2:30 PM'."""
    try:
        dt = datetime.fromisoformat(iso)
    except ValueError:
        return iso
    hour = dt.hour % 12 or 12
    ampm = "AM" if dt.hour < 12 else "PM"
    return f"{dt:%a} {dt:%b} {dt.day}, {hour}:{dt.minute:02d} {ampm}"


def _load() -> list[dict]:
    if not _APPTS_PATH.exists():
        return []
    try:
        return json.loads(_APPTS_PATH.read_text())
    except (json.JSONDecodeError, ValueError):
        return []


def _save(rows: list[dict]) -> None:
    _APPTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    _APPTS_PATH.write_text(json.dumps(rows[-200:], indent=2))


def get_availability(days: int = 5, *, per_day: int = 3) -> list[dict]:
    """Deterministic demo slots: next `days` business days, afternoon blocks.

    A real deployment would query the scheduler / clinician calendar here; the
    shape ({start, end, label}) is what the phone agent and UI consume.
    """
    slots: list[dict] = []
    cursor = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    found = 0
    while found < days:
        cursor += timedelta(days=1)
        if cursor.weekday() >= 5:  # skip Sat/Sun
            continue
        found += 1
        for i in range(per_day):
            start = cursor.replace(hour=14) + timedelta(minutes=_SLOT_MINUTES * i)
            end = start + timedelta(minutes=_SLOT_MINUTES)
            slots.append({
                "start": start.isoformat(),
                "end": end.isoformat(),
                "label": _label(start.isoformat()),
            })
    return slots


def offered_slots(n: int = 3) -> list[dict]:
    """The first open slot on each of the next `n` business days — what the phone
    agent reads out, so days are distinct (e.g. Mon, Tue, Wed)."""
    return get_availability(days=n, per_day=1)[:n]


def _fhir_appointment(appt: dict) -> dict:
    return {
        "resourceType": "Appointment",
        "status": "booked",
        "description": appt["reason"],
        "start": appt["start"],
        "end": appt["end"],
        "participant": [{
            "actor": {
                "reference": f"Patient/{appt['patient_id']}",
                "display": appt["patient_name"],
            },
            "status": "accepted",
        }],
    }


def _calendar_event(appt: dict) -> dict:
    return {
        "summary": f"{appt['reason']} — {appt['patient_name']}",
        "start": appt["start"],
        "end": appt["end"],
        "description": f"Booked by LoHop AI phone agent. Loop {appt.get('loop_id')}.",
        "attendee": appt["patient_name"],
    }


def push_to_calendar(appt: dict) -> dict:
    """Send to the configured calendar webhook, else local-only (with .ics)."""
    ics_url = f"/api/appointments/{appt['id']}/ics"
    if not CALENDAR_WEBHOOK_URL:
        return {"target": "local", "status": "stored", "ics": ics_url}
    try:
        r = httpx.post(CALENDAR_WEBHOOK_URL, json=_calendar_event(appt), timeout=20.0)
        r.raise_for_status()
        return {"target": CALENDAR_WEBHOOK_URL, "status": "pushed", "code": r.status_code, "ics": ics_url}
    except Exception as exc:  # noqa: BLE001
        return {"target": CALENDAR_WEBHOOK_URL, "status": "failed", "error": str(exc), "ics": ics_url}


def book_appointment(
    *,
    patient_id: str,
    patient_name: str,
    start: str,
    end: str | None = None,
    reason: str = "Follow-up appointment",
    practitioner: str | None = None,
    loop: Loop | None = None,
    source: str = "phone-agent",
    fhir: FhirClient | None = None,
) -> dict:
    """Persist a booked slot (custom calendar), then try FHIR Appointment + calendar push."""
    if not end:
        try:
            end = (datetime.fromisoformat(start) + timedelta(minutes=_SLOT_MINUTES)).isoformat()
        except ValueError:
            end = start

    appt = {
        "id": f"appt-{uuid.uuid4().hex[:8]}",
        "patient_id": patient_id.replace("Patient/", ""),
        "patient_name": patient_name,
        "start": start,
        "end": end,
        "label": _label(start),
        "reason": reason,
        "practitioner": practitioner,
        "loop_id": loop.id if loop else None,
        "source": source,
        "status": "booked",
        "created_at": _now().isoformat(),
        "fhir_id": None,
        "calendar": None,
    }

    # FHIR Appointment write-back (best-effort; server may be read-only).
    if fhir is not None:
        try:
            created = fhir.create(_fhir_appointment(appt))
            appt["fhir_id"] = created.get("id")
        except Exception as exc:  # noqa: BLE001
            appt["fhir_note"] = f"FHIR appointment not written ({exc})."

    appt["calendar"] = push_to_calendar(appt)

    rows = _load()
    rows.append(appt)
    _save(rows)
    return appt


def list_appointments(patient_id: str | None = None, loop_id: str | None = None) -> list[dict]:
    rows = _load()
    if patient_id:
        pid = patient_id.replace("Patient/", "")
        rows = [a for a in rows if a.get("patient_id") == pid]
    if loop_id:
        rows = [a for a in rows if a.get("loop_id") == loop_id]
    return rows


def get_appointment(appt_id: str) -> dict | None:
    for a in _load():
        if a.get("id") == appt_id:
            return a
    return None


def appointment_ics(appt: dict) -> str:
    """A minimal RFC 5545 VEVENT — opens in any calendar app (the custom calendar)."""
    def _dt(iso: str) -> str:
        try:
            return datetime.fromisoformat(iso).astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        except ValueError:
            return iso
    return "\r\n".join([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//LoHop//Safety Net//EN",
        "BEGIN:VEVENT",
        f"UID:{appt['id']}@lohop",
        f"DTSTAMP:{_dt(appt['created_at'])}",
        f"DTSTART:{_dt(appt['start'])}",
        f"DTEND:{_dt(appt['end'])}",
        f"SUMMARY:{appt['reason']} — {appt['patient_name']}",
        f"DESCRIPTION:Booked by LoHop AI phone agent. Loop {appt.get('loop_id')}.",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
    ])
