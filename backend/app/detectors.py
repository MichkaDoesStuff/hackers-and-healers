"""Deterministic loop detectors. Each scans FHIR and returns Loop candidates.

No LLM here on purpose: detection must be inspectable and reproducible.
"""
from __future__ import annotations

from .config import (
    ABNORMAL_INTERPRETATIONS,
    ABNORMAL_UNACKED_DAYS,
    CRITICAL_INTERPRETATIONS,
    ORDERED_NOT_RESULTED_DAYS,
    REFERRAL_NO_RESPONSE_DAYS,
)
from . import state
from .fhir import FhirClient
from .models import FocusRef, Loop
from .util import (
    code_text,
    days_ago,
    interpretation_codes,
    obs_value,
    patient_display,
    ref_id,
)

MONEY_EXT = "http://loop.health/money-at-risk"
REJECTED_EXT = "http://loop.health/rejected-lines"


def _actioned_focuses(fhir: FhirClient) -> set[str]:
    """Resource refs that are already handled, so their loop should not re-open.

    Source of truth is Loop's own actioned store (immediately consistent). We also
    union any acknowledging Tasks found via FHIR search, which covers acks made
    outside Loop once HAPI has indexed them.
    """
    refs = set(state.actioned_focuses())
    try:
        for task in fhir.search("Task", max_pages=20):
            ref = (task.get("focus") or {}).get("reference")
            if ref:
                refs.add(ref)
    except Exception:
        pass  # store alone is enough; FHIR search is a best-effort supplement
    return refs


class _PatientCache:
    def __init__(self, fhir: FhirClient):
        self.fhir = fhir
        self._cache: dict[str, dict] = {}

    def get(self, pid: str | None) -> dict | None:
        if not pid:
            return None
        if pid not in self._cache:
            self._cache[pid] = self.fhir.read("Patient", pid) or {}
        return self._cache[pid] or None


def detect_all(fhir: FhirClient) -> list[Loop]:
    pc = _PatientCache(fhir)
    actioned = _actioned_focuses(fhir)  # computed once; shared by all detectors
    loops: list[Loop] = []
    for fn in (
        detect_abnormal_unacked,
        detect_ordered_not_resulted,
        detect_referral_no_response,
        detect_billing_unreconciled,
    ):
        try:
            loops.extend(fn(fhir, pc, actioned))
        except Exception as e:  # one detector failing must not blank the worklist
            print(f"[detector error] {fn.__name__}: {e}")
    return loops


def detect_abnormal_unacked(fhir: FhirClient, pc: _PatientCache, actioned: set[str]) -> list[Loop]:
    """Final lab result, abnormal, old enough, with no acknowledging Task."""
    out: list[Loop] = []
    obs_list = fhir.search(
        "Observation",
        {"category": "laboratory", "status": "final", "_sort": "-date", "_count": "200"},
    )
    for obs in obs_list:
        codes = interpretation_codes(obs)
        if not (codes & ABNORMAL_INTERPRETATIONS):
            continue
        age = days_ago(obs.get("effectiveDateTime") or obs.get("issued"))
        if age < ABNORMAL_UNACKED_DAYS:
            continue
        oid = obs.get("id")
        if not oid:
            continue
        if f"Observation/{oid}" in actioned:
            continue  # already being followed up
        pid = ref_id((obs.get("subject") or {}).get("reference"))
        patient = pc.get(pid)
        name = patient_display(patient)
        label = code_text(obs.get("code")) or "lab result"
        value = obs_value(obs)
        critical = bool(codes & CRITICAL_INTERPRETATIONS)
        out.append(
            Loop(
                id=f"abn-{oid}",
                type="abnormal_result",
                title=f"{name} - {label} {value}".strip(),
                subtitle=f"{'Critical' if critical else 'Abnormal'} result, unreviewed {age} days",
                patient_id=pid or "",
                patient_name=name,
                focus=[FocusRef(resourceType="Observation", id=oid)],
                detected_days_ago=age,
                why=[
                    f"interpretation {'/'.join(sorted(codes))}"
                    + (" (CRITICAL)" if critical else ""),
                    f"unacknowledged {age} days (>{ABNORMAL_UNACKED_DAYS})",
                    "no follow-up Task found",
                ],
            )
        )
    return out


def detect_ordered_not_resulted(fhir: FhirClient, pc: _PatientCache, actioned: set[str]) -> list[Loop]:
    """Active lab/imaging order with no returning result past the turnaround window."""
    out: list[Loop] = []
    reqs = fhir.search("ServiceRequest", {"status": "active", "_sort": "-authored", "_count": "200"})
    for sr in reqs:
        label = code_text(sr.get("code")) or "test"
        if "referral" in label.lower():
            continue  # handled by referral detector
        age = days_ago(sr.get("authoredOn"))
        if age < ORDERED_NOT_RESULTED_DAYS:
            continue
        sid = sr.get("id")
        if not sid:
            continue
        if f"ServiceRequest/{sid}" in actioned:
            continue
        reports = fhir.search("DiagnosticReport", {"based-on": f"ServiceRequest/{sid}", "_count": "1"})
        results = fhir.search("Observation", {"based-on": f"ServiceRequest/{sid}", "_count": "1"})
        if reports or results:
            continue
        pid = ref_id((sr.get("subject") or {}).get("reference"))
        name = patient_display(pc.get(pid))
        out.append(
            Loop(
                id=f"onr-{sid}",
                type="ordered_not_resulted",
                title=f"{name} - {label}",
                subtitle=f"Ordered {age} days ago, no result returned",
                patient_id=pid or "",
                patient_name=name,
                focus=[FocusRef(resourceType="ServiceRequest", id=sid)],
                detected_days_ago=age,
                why=[
                    f"order active {age} days (>{ORDERED_NOT_RESULTED_DAYS})",
                    "no DiagnosticReport or Observation linked",
                ],
            )
        )
    return out


def detect_referral_no_response(fhir: FhirClient, pc: _PatientCache, actioned: set[str]) -> list[Loop]:
    """Active referral past the window with no linked consult Encounter/Communication."""
    out: list[Loop] = []
    reqs = fhir.search("ServiceRequest", {"status": "active", "_sort": "-authored", "_count": "200"})
    for sr in reqs:
        label = code_text(sr.get("code"))
        if "referral" not in label.lower():
            continue
        age = days_ago(sr.get("authoredOn"))
        if age < REFERRAL_NO_RESPONSE_DAYS:
            continue
        sid = sr.get("id")
        if not sid:
            continue
        if f"ServiceRequest/{sid}" in actioned:
            continue
        comms = fhir.search("Communication", {"based-on": f"ServiceRequest/{sid}", "_count": "1"})
        if comms:
            continue
        pid = ref_id((sr.get("subject") or {}).get("reference"))
        name = patient_display(pc.get(pid))
        out.append(
            Loop(
                id=f"ref-{sid}",
                type="referral_no_response",
                title=f"{name} - {label}",
                subtitle=f"No reply in {age} days",
                patient_id=pid or "",
                patient_name=name,
                focus=[FocusRef(resourceType="ServiceRequest", id=sid)],
                detected_days_ago=age,
                why=[f"referral sent {age} days ago (>{REFERRAL_NO_RESPONSE_DAYS})", "no response linked"],
            )
        )
    return out


def detect_billing_unreconciled(fhir: FhirClient, pc: _PatientCache, actioned: set[str]) -> list[Loop]:
    """Rejected/partial claim responses = money at risk if not reconciled."""
    out: list[Loop] = []
    responses = fhir.search("ClaimResponse", {"_count": "200"})
    for cr in responses:
        if cr.get("outcome") not in ("error", "partial"):
            continue
        rid = cr.get("id")
        if not rid:
            continue
        if f"ClaimResponse/{rid}" in actioned:
            continue
        money = _ext_decimal(cr, MONEY_EXT)
        rejected = _ext_decimal(cr, REJECTED_EXT)
        age = days_ago(cr.get("created"))
        pid = ref_id((cr.get("patient") or {}).get("reference"))
        # Billing batches may not be patient-specific; fall back to a batch label.
        batch = (cr.get("identifier") or [{}])[0].get("value", rid)
        money_str = f"${money:,.0f}" if money else "amount under review"
        rej_str = f"{int(rejected)} lines rejected" if rejected else "rejected"
        out.append(
            Loop(
                id=f"bil-{rid}",
                type="billing_unreconciled",
                title=f"Billing - batch #{batch}",
                subtitle=f"{rej_str}, {money_str} at risk",
                patient_id=pid or "",
                patient_name="Billing",
                focus=[FocusRef(resourceType="ClaimResponse", id=rid)],
                detected_days_ago=age,
                money_at_risk=money,
                why=[f"claim outcome '{cr.get('outcome')}'", f"{rej_str}", "not yet reconciled"],
            )
        )
    return out


def _ext_decimal(resource: dict, url: str) -> float | None:
    for ext in resource.get("extension", []):
        if ext.get("url") == url:
            if "valueDecimal" in ext:
                return float(ext["valueDecimal"])
            if "valueMoney" in ext:
                return float(ext["valueMoney"].get("value", 0))
    return None
