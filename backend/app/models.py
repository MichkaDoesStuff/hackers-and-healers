"""Loop = a detected stalled task. This is the shape the worklist API returns."""
from __future__ import annotations

from pydantic import BaseModel, Field


class FocusRef(BaseModel):
    resourceType: str
    id: str


class Loop(BaseModel):
    id: str
    type: str                       # abnormal_result | ordered_not_resulted | referral_no_response | billing_unreconciled
    title: str                      # e.g. "Robert M. - potassium 6.1"
    subtitle: str                   # e.g. "Critical result, unreviewed 19 days"
    patient_id: str
    patient_name: str
    focus: list[FocusRef] = Field(default_factory=list)
    detected_days_ago: int = 0
    money_at_risk: float | None = None   # billing loops only
    why: list[str] = Field(default_factory=list)
    # filled by the risk scorer
    score: int = 0
    band: str = "routine"           # critical | high | medium | routine
