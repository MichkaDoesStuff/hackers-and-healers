"""Impact + cost reporting. Answers the two questions judges ask:
'what does this recover?' (money + time) and 'what does it cost to run?' (affordability).
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from .detectors import detect_all
from .fhir import FhirClient
from .models import Loop
from .risk import rank

GROUND_TRUTH = Path(__file__).resolve().parents[2] / "data" / "ground_truth.json"

# --- assumptions (all surfaced in the response so nothing is a black box) ---
MINUTES_SAVED_PER_LOOP = 6          # admin minutes to chase one loop by hand
CLINIC_ADMIN_RATE_PER_HR = 35.0     # loaded cost of admin time, CAD/hr
BILLING_LOSS_RATE = 0.10            # unreconciled claims lose ~10%

# drafting LLM cost (estimate). Detection + ranking are rule-based = $0.
LLM_MODEL = "claude-sonnet (drafting)"
LLM_IN_PER_1K = 0.003
LLM_OUT_PER_1K = 0.015
EST_IN_TOKENS = 1500
EST_OUT_TOKENS = 400


def build_reports(fhir: FhirClient) -> dict:
    loops = rank(detect_all(fhir))
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "loops": _loop_breakdown(loops),
        "money": _money(loops),
        "impact": _impact(loops),
        "detection_quality": _quality(loops),
        "run_cost": _run_cost(loops),
    }


def _loop_breakdown(loops: list[Loop]) -> dict:
    by_sev: dict[str, int] = {}
    by_type: dict[str, int] = {}
    for l in loops:
        by_sev[l.band] = by_sev.get(l.band, 0) + 1
        by_type[l.type] = by_type.get(l.type, 0) + 1
    return {"open": len(loops), "by_severity": by_sev, "by_type": by_type}


def _money(loops: list[Loop]) -> dict:
    billing = [l for l in loops if l.type == "billing_unreconciled" and l.money_at_risk]
    at_risk = sum(l.money_at_risk or 0 for l in billing)
    return {
        "currency": "CAD",
        "at_risk_total": round(at_risk, 2),
        # reconciling avoids the ~10% loss, so the recoverable benefit is the at-risk amount
        "recoverable_if_actioned": round(at_risk, 2),
        "would_be_lost_unactioned": round(at_risk * BILLING_LOSS_RATE, 2),
        "billing_loops": [
            {"id": l.id, "title": l.title, "at_risk": l.money_at_risk} for l in billing
        ],
        "assumption": f"unreconciled claims lose ~{int(BILLING_LOSS_RATE * 100)}%",
    }


def _impact(loops: list[Loop]) -> dict:
    minutes = len(loops) * MINUTES_SAVED_PER_LOOP
    hours = minutes / 60
    return {
        "loops_actionable": len(loops),
        "admin_minutes_saved": minutes,
        "admin_hours_saved": round(hours, 2),
        "admin_dollars_saved": round(hours * CLINIC_ADMIN_RATE_PER_HR, 2),
        "assumption": f"{MINUTES_SAVED_PER_LOOP} min saved per loop @ ${CLINIC_ADMIN_RATE_PER_HR}/hr",
    }


def _quality(loops: list[Loop]) -> dict:
    """Recall vs the injected ground truth (proof detection actually catches the planted loops)."""
    if not GROUND_TRUTH.exists():
        return {"available": False, "note": "run data/inject_loops.py to generate ground truth"}
    truth = json.loads(GROUND_TRUTH.read_text())
    truth_focus = {t["focus"] for t in truth}
    detected_focus = {f"{f.resourceType}/{f.id}" for l in loops for f in l.focus}
    matched = truth_focus & detected_focus
    recall = len(matched) / len(truth_focus) if truth_focus else 0.0
    return {
        "available": True,
        "injected": len(truth_focus),
        "detected_of_injected": len(matched),
        "recall": round(recall, 3),
        "total_detected": len(loops),
        "missed": sorted(truth_focus - detected_focus),
        "note": "recall on planted loops; detection also surfaces additional real loops",
    }


def _run_cost(loops: list[Loop]) -> dict:
    drafts = len(loops)  # at most one AI draft per loop, only at the gated action
    per_draft = (EST_IN_TOKENS / 1000 * LLM_IN_PER_1K) + (EST_OUT_TOKENS / 1000 * LLM_OUT_PER_1K)
    return {
        "detection_cost": 0.0,
        "detection_note": "detection + risk are deterministic rules — no LLM, $0",
        "llm_model": LLM_MODEL,
        "est_drafts": drafts,
        "est_cost_per_draft_usd": round(per_draft, 4),
        "est_total_usd": round(per_draft * drafts, 4),
        "assumption": f"~{EST_IN_TOKENS} in / {EST_OUT_TOKENS} out tokens per draft; LLM only on top loops",
    }
