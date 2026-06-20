import type { Issue } from "./types"

/** Default CDS Sandbox demo patient on lohp. */
export const DEMO_SANDBOX_PATIENT = "b61008f3-84e2-8e3f-abd9-995a23133d57"

/** CDS Sandbox + lohp.ryanbeland.dev test patients → sample open loops for demo. */
const SANDBOX_ISSUES: Record<string, Issue[]> = {
  [DEMO_SANDBOX_PATIENT]: [
    {
      id: "sb-afton-a1c",
      patientId: DEMO_SANDBOX_PATIENT,
      patientName: "Afton574 Greenholt190",
      title: "A1c overdue",
      summary: "Last result 14 months ago",
      severity: "warning",
      category: "lab",
      ageDays: 420,
      source: "loop-summary",
      detail:
        "Diabetes monitoring A1c is overdue per guideline. No repeat order is open and the patient has not been contacted to schedule labs.",
    },
    {
      id: "sb-afton-bp",
      patientId: DEMO_SANDBOX_PATIENT,
      patientName: "Afton574 Greenholt190",
      title: "BP follow-up",
      summary: "Elevated reading, no recheck in 6 weeks",
      severity: "routine",
      category: "follow-up",
      ageDays: 42,
      source: "loop-summary",
      detail:
        "Blood pressure was elevated at the last visit. A two-week home log and recheck were recommended but not completed.",
    },
    {
      id: "sb-afton-ref",
      patientId: DEMO_SANDBOX_PATIENT,
      patientName: "Afton574 Greenholt190",
      title: "Endocrinology referral",
      summary: "Sent 10 days ago — no reply",
      severity: "warning",
      category: "referral",
      ageDays: 10,
      source: "loop-summary",
      detail:
        "Referral to endocrinology was placed 10 days ago for glycemic management. The receiving practice has not acknowledged or scheduled.",
    },
  ],
}

export function sandboxIssuesForPatient(patientId: string | null | undefined): Issue[] | null {
  if (!patientId) return null
  const key = patientId.replace(/^Patient\//, "").toLowerCase()
  for (const [id, issues] of Object.entries(SANDBOX_ISSUES)) {
    if (id.toLowerCase() === key) return issues
  }
  return null
}

/** Demo loops for embed when FHIR/API is slow or patient id doesn't match our map. */
export function demoIssuesForEmbed(patientId?: string | null): Issue[] {
  const demo = SANDBOX_ISSUES[DEMO_SANDBOX_PATIENT] ?? []
  if (!patientId) return demo
  const pid = patientId.replace(/^Patient\//, "")
  return demo.map((issue) => ({ ...issue, patientId: pid }))
}
