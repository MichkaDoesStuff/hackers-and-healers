export type Severity = "critical" | "warning" | "routine"

export type IssueCategory =
  | "lab"
  | "referral"
  | "billing"
  | "medication"
  | "follow-up"
  | "screening"

export interface Issue {
  id: string
  /** Backend loop id for draft/approve API — absent on sandbox-only samples */
  loopId?: string
  /** Backend loop_type for playbook lookup */
  loopType?: string
  patientId: string
  patientName: string
  /** short headline, e.g. "Potassium 6.1 — critical, unreviewed" */
  title: string
  /** one-line context shown under the title */
  summary: string
  severity: Severity
  category: IssueCategory
  /** how long the loop has been open, in days */
  ageDays: number
  /** the CDS Hooks service that surfaced this card */
  source: string
  /** longer detail rendered in the workflow header */
  detail: string
}

export interface Patient {
  id: string
  name: string
  age: number
  sex: "M" | "F"
  mrn: string
  /** active problem list */
  conditions: string[]
  medications: string[]
  lastSeen: string
  issues: Issue[]
}

/* ---- workflow graph ---- */

export type StepKind =
  | "trigger"
  | "detect"
  | "draft"
  | "order"
  | "notify"
  | "decision"
  | "resolve"

export interface WorkflowStepData extends Record<string, unknown> {
  kind: StepKind
  title: string
  detail: string
  /** owner / actor responsible for this step */
  actor?: string
  /** editable instruction for AI steps (draft/detect) — the prompt Claude runs */
  prompt?: string
  /** notify (Twilio) node: destination phone number */
  to?: string
  /** notify (Twilio) node: SMS message body */
  message?: string
}
