import type { Edge, Node } from "@xyflow/react"
import type { Issue, IssueCategory, WorkflowStepData } from "./types"

export type StepNode = Node<WorkflowStepData>

interface Template {
  steps: Array<WorkflowStepData & { x: number; y: number }>
}

const TEMPLATES: Record<IssueCategory, Template> = {
  lab: {
    steps: [
      { kind: "trigger", title: "patient-view fired", detail: "Chart opened in ClinicOS", actor: "EHR", x: 0, y: 120 },
      { kind: "detect", title: "Critical result detected", detail: "Lab value crosses safety threshold, unreviewed", actor: "Loop", x: 280, y: 120 },
      { kind: "draft", title: "Draft clinician message", detail: "Claude drafts a summary + recommended action", actor: "Loop AI", x: 560, y: 0, prompt: "You are drafting a short message to the patient's family physician about an abnormal lab result. Summarize the result, explain why it matters given the patient's active medications and problem list, and recommend the next action. Be specific and non-alarming. Do not diagnose. 3-4 sentences." },
      { kind: "order", title: "Suggest repeat lab", detail: "Pre-fill order for confirmatory recheck", actor: "Loop", x: 560, y: 240 },
      { kind: "decision", title: "Clinician reviews", detail: "Accept, adjust, or dismiss the card", actor: "Clinician", x: 840, y: 120 },
      { kind: "resolve", title: "Loop closed", detail: "Acknowledgment written back to chart", actor: "Loop", x: 1120, y: 120 },
    ],
  },
  referral: {
    steps: [
      { kind: "trigger", title: "patient-view fired", detail: "Chart opened in ClinicOS", actor: "EHR", x: 0, y: 100 },
      { kind: "detect", title: "Referral unanswered", detail: "No acknowledgment from receiving practice", actor: "Loop", x: 280, y: 100 },
      { kind: "notify", title: "Nudge specialist", detail: "Secure message to cardiology intake", actor: "Loop", x: 560, y: 100 },
      { kind: "decision", title: "Reply received?", detail: "Branch on specialist response", actor: "Clinician", x: 840, y: 100 },
      { kind: "resolve", title: "Appointment booked", detail: "Loop closed, visit on the schedule", actor: "Loop", x: 1120, y: 100 },
    ],
  },
  billing: {
    steps: [
      { kind: "trigger", title: "Claim batch posted", detail: "Batch returns from clearinghouse", actor: "EHR", x: 0, y: 100 },
      { kind: "detect", title: "Rejections flagged", detail: "14 lines rejected, $1,240 at risk", actor: "Loop", x: 280, y: 100 },
      { kind: "draft", title: "Draft correction", detail: "Add prior-auth modifier to each line", actor: "Loop AI", x: 560, y: 100, prompt: "Draft a corrected claim resubmission for the rejected lines. State the rejection reason, the fix (e.g. add the prior-authorization modifier), and confirm the timely-filing deadline. Output a short, billing-ready summary." },
      { kind: "decision", title: "Biller approves", detail: "Review proposed resubmission", actor: "Billing", x: 840, y: 100 },
      { kind: "resolve", title: "Resubmit before deadline", detail: "Loop closed inside filing window", actor: "Loop", x: 1120, y: 100 },
    ],
  },
  medication: {
    steps: [
      { kind: "trigger", title: "patient-view fired", detail: "Chart opened in ClinicOS", actor: "EHR", x: 0, y: 100 },
      { kind: "detect", title: "Interaction detected", detail: "Med pair raises a safety concern", actor: "Loop", x: 280, y: 100 },
      { kind: "draft", title: "Draft adjustment", detail: "Propose dose change or substitution", actor: "Loop AI", x: 560, y: 100, prompt: "Propose a medication adjustment for the flagged interaction. Name the interacting drugs, the risk, and a specific dose change or substitution. Keep it to 2-3 sentences for clinician review. Do not finalize any order." },
      { kind: "decision", title: "Clinician reviews", detail: "Accept or override", actor: "Clinician", x: 840, y: 100 },
      { kind: "resolve", title: "Loop closed", detail: "Order updated, patient notified", actor: "Loop", x: 1120, y: 100 },
    ],
  },
  "follow-up": {
    steps: [
      { kind: "trigger", title: "Follow-up due", detail: "Overdue follow-up detected for this patient", actor: "Loop", x: 0, y: 100 },
      { kind: "draft", title: "Draft call script", detail: "Claude drafts what the AI agent should say and ask", actor: "Loop AI", x: 280, y: 100, prompt: "Write a short, warm phone-call opening for an AI scheduling agent calling a patient on behalf of their clinic to book an overdue follow-up appointment. State who is calling and why, then ask which day/time works best. 2-3 sentences, plain spoken language, reassuring, no medical advice or diagnosis." },
      { kind: "call", title: "AI calls patient", detail: "Twilio voice agent phones the patient and offers open slots", actor: "Phone agent", x: 560, y: 100 },
      { kind: "book", title: "Book chosen slot", detail: "Store the time the patient picked (the appointment record)", actor: "Loop", x: 840, y: 100 },
      { kind: "calendar", title: "Update calendar", detail: "Add the visit to the clinic / Google calendar", actor: "Loop", x: 1120, y: 100 },
      { kind: "resolve", title: "Visit booked", detail: "Loop closed, note written to chart", actor: "Loop", x: 1400, y: 100 },
    ],
  },
  screening: {
    steps: [
      { kind: "trigger", title: "patient-view fired", detail: "Chart opened in ClinicOS", actor: "EHR", x: 0, y: 100 },
      { kind: "detect", title: "Screening overdue", detail: "Guideline interval lapsed", actor: "Loop", x: 280, y: 100 },
      { kind: "order", title: "Pre-fill order", detail: "Stage the screening order", actor: "Loop", x: 560, y: 100 },
      { kind: "notify", title: "Invite patient", detail: "Outreach to schedule", actor: "Loop", x: 840, y: 100 },
      { kind: "resolve", title: "Scheduled", detail: "Loop closed", actor: "Loop", x: 1120, y: 100 },
    ],
  },
}

export function buildWorkflow(issue: Issue): { nodes: StepNode[]; edges: Edge[] } {
  const tpl = TEMPLATES[issue.category]
  const nodes: StepNode[] = tpl.steps.map((s, i) => ({
    id: `n${i}`,
    type: "step",
    position: { x: s.x, y: s.y },
    data: { kind: s.kind, title: s.title, detail: s.detail, actor: s.actor, prompt: s.prompt },
  }))

  // chain linearly; if a step branches (two nodes share roughly the same x),
  // connect the trigger to both — handled simply by sequential + fan where x repeats
  const edges: Edge[] = []
  for (let i = 0; i < nodes.length - 1; i++) {
    const from = nodes[i]
    const to = nodes[i + 1]
    edges.push({
      id: `e${i}`,
      source: from.id,
      target: to.id,
      animated: i === 0,
    })
  }
  // extra fan edges where two nodes share an x column after a branch point
  for (let i = 1; i < nodes.length - 1; i++) {
    const a = nodes[i]
    const b = nodes[i + 1]
    if (Math.abs(a.position.x - b.position.x) < 1) {
      // both come from the previous node
      edges.push({
        id: `ef${i}`,
        source: nodes[i - 1].id,
        target: b.id,
      })
    }
  }
  return { nodes, edges }
}
