"""Deterministic risk scoring + banding. No LLM. Fully reproducible."""
from __future__ import annotations

from .config import CRITICAL_INTERPRETATIONS, LOOP_TYPE_HARM, RISK_WEIGHTS
from .models import Loop


def score_loop(loop: Loop) -> Loop:
    w = RISK_WEIGHTS
    severity = 0
    # Critical lab result = top severity (read from the "why" notes the detector recorded).
    if loop.type == "abnormal_result" and any("CRITICAL" in r for r in loop.why):
        severity = 1
    # Money at risk scales billing severity a little.
    money_factor = 0
    if loop.money_at_risk:
        money_factor = min(loop.money_at_risk / 1000.0, 5)  # cap

    harm = LOOP_TYPE_HARM.get(loop.type, 10)
    overdue = loop.detected_days_ago

    score = (
        w["severity"] * severity
        + w["overdue"] * overdue
        + w["harm"] * harm
        + int(money_factor * 10)
    )
    loop.score = int(score)
    loop.band = _band(loop, severity)
    return loop


def _band(loop: Loop, severity: int) -> str:
    if severity:  # any critical result
        return "critical"
    if loop.type == "billing_unreconciled" and (loop.money_at_risk or 0) >= 1000:
        return "high"  # real dollars at risk grabs attention
    if loop.score >= 80:
        return "high"
    if loop.score >= 50:
        return "medium"
    return "routine"


def rank(loops: list[Loop]) -> list[Loop]:
    scored = [score_loop(l) for l in loops]
    order = {"critical": 0, "high": 1, "medium": 2, "routine": 3}
    scored.sort(key=lambda l: (order.get(l.band, 9), -l.score))
    return scored
