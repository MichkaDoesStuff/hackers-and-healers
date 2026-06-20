import type { Issue, IssueCategory, Severity } from "./types"

const BAND_TO_SEVERITY: Record<string, Severity> = {
  critical: "critical",
  high: "warning",
  medium: "warning",
  routine: "routine",
}

const TYPE_TO_CATEGORY: Record<string, IssueCategory> = {
  abnormal_result: "lab",
  ordered_not_resulted: "follow-up",
  referral_no_response: "referral",
  billing_unreconciled: "billing",
}

/** Category → backend loop_type for playbook lookup */
export const CATEGORY_TO_LOOP_TYPE: Record<IssueCategory, string> = {
  lab: "abnormal_result",
  "follow-up": "ordered_not_resulted",
  referral: "referral_no_response",
  billing: "billing_unreconciled",
  medication: "abnormal_result",
  screening: "ordered_not_resulted",
}

export interface BackendLoop {
  id: string
  type: string
  title: string
  subtitle: string
  patient_id: string
  patient_name: string
  detected_days_ago: number
  band: string
  why?: string[]
}

export function mapLoopToIssue(loop: BackendLoop): Issue {
  return {
    id: loop.id,
    loopId: loop.id,
    loopType: loop.type,
    patientId: loop.patient_id,
    patientName: loop.patient_name,
    title: loop.title,
    summary: loop.subtitle,
    severity: BAND_TO_SEVERITY[loop.band] ?? "routine",
    category: TYPE_TO_CATEGORY[loop.type] ?? "follow-up",
    ageDays: loop.detected_days_ago,
    source: "loop-detection",
    detail: loop.why?.length ? loop.why.join(" · ") : loop.subtitle,
  }
}
