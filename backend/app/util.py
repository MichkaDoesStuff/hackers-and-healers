"""Small FHIR parsing helpers shared by detectors."""
from __future__ import annotations

from datetime import datetime, timezone


def days_ago(iso: str | None) -> int:
    """Whole days between an ISO datetime/date and now. 0 if unparseable."""
    if not iso:
        return 0
    s = iso.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        # date-only or partial
        try:
            dt = datetime.fromisoformat(s[:10])
        except ValueError:
            return 0
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return max(0, (datetime.now(timezone.utc) - dt).days)


def patient_display(patient: dict | None) -> str:
    """Human name from a FHIR Patient, e.g. 'Robert M.'."""
    if not patient:
        return "Unknown patient"
    names = patient.get("name") or []
    if not names:
        return f"Patient {patient.get('id', '?')}"
    n = names[0]
    given = (n.get("given") or [""])[0]
    family = n.get("family", "")
    family_initial = (family[:1] + ".") if family else ""
    full = f"{given} {family_initial}".strip()
    return full or n.get("text", "Unknown patient")


def ref_id(reference: str | None) -> str | None:
    """'Patient/123' -> '123'."""
    if not reference:
        return None
    return reference.split("/")[-1]


def code_text(codeable: dict | None) -> str:
    if not codeable:
        return ""
    if codeable.get("text"):
        return codeable["text"]
    for c in codeable.get("coding", []):
        if c.get("display"):
            return c["display"]
    return ""


def obs_value(obs: dict) -> str:
    vq = obs.get("valueQuantity")
    if vq:
        v = vq.get("value")
        unit = vq.get("unit", "")
        return f"{v} {unit}".strip()
    if "valueString" in obs:
        return obs["valueString"]
    cc = obs.get("valueCodeableConcept")
    if cc:
        return code_text(cc)
    return ""


def interpretation_codes(obs: dict) -> set[str]:
    out: set[str] = set()
    for interp in obs.get("interpretation", []):
        for c in interp.get("coding", []):
            if c.get("code"):
                out.add(c["code"])
    return out
