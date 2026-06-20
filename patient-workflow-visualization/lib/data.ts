import type { Issue, Patient, Severity } from "./types"

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  routine: 2,
}

export const patients: Patient[] = [
  {
    id: "p-robert-m",
    name: "Robert Maddox",
    age: 67,
    sex: "M",
    mrn: "MRN-4471",
    conditions: ["Hypertension", "Chronic kidney disease, stage 3", "Type 2 diabetes"],
    medications: ["Lisinopril 20mg", "Metformin 1000mg", "Atorvastatin 40mg"],
    lastSeen: "May 2",
    issues: [
      {
        id: "i-robert-k",
        patientId: "p-robert-m",
        patientName: "Robert Maddox",
        title: "Potassium 6.1 mEq/L",
        summary: "Critical result, unreviewed 19 days",
        severity: "critical",
        category: "lab",
        ageDays: 19,
        source: "loop-summary",
        detail:
          "Critical hyperkalemia (6.1 mEq/L) resulted 19 days ago and was never acknowledged. Patient is on lisinopril, an ACE inhibitor, which raises potassium — the combination needs urgent review before the next refill.",
      },
      {
        id: "i-robert-ref",
        patientId: "p-robert-m",
        patientName: "Robert Maddox",
        title: "Cardiology referral",
        summary: "No reply in 12 days",
        severity: "warning",
        category: "referral",
        ageDays: 12,
        source: "loop-summary",
        detail:
          "Referral to cardiology placed 12 days ago for new-onset arrhythmia has no acknowledgment or scheduled appointment from the receiving practice.",
      },
    ],
  },
  {
    id: "p-billing-2291",
    name: "Billing — batch #2291",
    age: 0,
    sex: "M",
    mrn: "CLAIM-2291",
    conditions: ["Claims batch"],
    medications: [],
    lastSeen: "May 18",
    issues: [
      {
        id: "i-billing-2291",
        patientId: "p-billing-2291",
        patientName: "Billing — batch #2291",
        title: "Billing — batch #2291",
        summary: "14 lines rejected, $1,240 at risk",
        severity: "critical",
        category: "billing",
        ageDays: 3,
        source: "loop-billing",
        detail:
          "14 claim lines in batch #2291 were rejected by the payer for a missing prior-authorization modifier. $1,240 is at risk and the timely-filing window closes in 11 days.",
      },
    ],
  },
  {
    id: "p-elena-r",
    name: "Elena Rodriguez",
    age: 54,
    sex: "F",
    mrn: "MRN-3318",
    conditions: ["Hypothyroidism", "Anxiety"],
    medications: ["Levothyroxine 75mcg", "Sertraline 50mg"],
    lastSeen: "Apr 28",
    issues: [
      {
        id: "i-elena-tsh",
        patientId: "p-elena-r",
        patientName: "Elena Rodriguez",
        title: "TSH 8.9 mIU/L",
        summary: "Elevated, dose unchanged 6 weeks",
        severity: "warning",
        category: "lab",
        ageDays: 42,
        source: "loop-summary",
        detail:
          "TSH came back elevated at 8.9 mIU/L six weeks ago, suggesting the current levothyroxine dose is too low, but no adjustment or recheck has been ordered.",
      },
      {
        id: "i-elena-followup",
        patientId: "p-elena-r",
        patientName: "Elena Rodriguez",
        title: "Routine follow-up",
        summary: "Awaiting patient response",
        severity: "routine",
        category: "follow-up",
        ageDays: 5,
        source: "loop-summary",
        detail:
          "A routine 3-month follow-up outreach was sent 5 days ago and is awaiting a response from the patient to book a visit.",
      },
    ],
  },
  {
    id: "p-james-o",
    name: "James Okafor",
    age: 71,
    sex: "M",
    mrn: "MRN-2204",
    conditions: ["Atrial fibrillation", "Hyperlipidemia"],
    medications: ["Warfarin 5mg", "Rosuvastatin 20mg"],
    lastSeen: "May 9",
    issues: [
      {
        id: "i-james-inr",
        patientId: "p-james-o",
        patientName: "James Okafor",
        title: "INR 4.4 — supratherapeutic",
        summary: "Bleeding risk, unreviewed 8 days",
        severity: "critical",
        category: "lab",
        ageDays: 8,
        source: "loop-summary",
        detail:
          "INR of 4.4 on warfarin is supratherapeutic and raises bleeding risk. The result is 8 days old with no dose hold or follow-up recheck documented.",
      },
    ],
  },
  {
    id: "p-priya-s",
    name: "Priya Sharma",
    age: 46,
    sex: "F",
    mrn: "MRN-5562",
    conditions: ["Asthma"],
    medications: ["Albuterol PRN", "Fluticasone inhaler"],
    lastSeen: "Mar 30",
    issues: [
      {
        id: "i-priya-mammo",
        patientId: "p-priya-s",
        patientName: "Priya Sharma",
        title: "Mammogram overdue",
        summary: "Screening lapsed 14 months",
        severity: "warning",
        category: "screening",
        ageDays: 420,
        source: "loop-summary",
        detail:
          "Routine screening mammogram is 14 months overdue per guideline. No order is open and the patient has not been contacted about scheduling.",
      },
    ],
  },
  {
    id: "p-david-l",
    name: "David Lin",
    age: 39,
    sex: "M",
    mrn: "MRN-6790",
    conditions: ["Migraine"],
    medications: ["Sumatriptan PRN"],
    lastSeen: "May 15",
    issues: [],
  },
  {
    id: "p-grace-w",
    name: "Grace Whitfield",
    age: 29,
    sex: "F",
    mrn: "MRN-7781",
    conditions: ["Healthy adult"],
    medications: [],
    lastSeen: "Apr 11",
    issues: [],
  },
  {
    id: "p-tomas-n",
    name: "Tomás Núñez",
    age: 58,
    sex: "M",
    mrn: "MRN-8123",
    conditions: ["Osteoarthritis"],
    medications: ["Ibuprofen PRN"],
    lastSeen: "May 1",
    issues: [],
  },
  {
    id: "p-aisha-k",
    name: "Aisha Khan",
    age: 33,
    sex: "F",
    mrn: "MRN-9007",
    conditions: ["Pregnancy, 2nd trimester"],
    medications: ["Prenatal vitamins"],
    lastSeen: "May 17",
    issues: [],
  },
  {
    id: "p-walter-b",
    name: "Walter Brennan",
    age: 62,
    sex: "M",
    mrn: "MRN-1145",
    conditions: ["COPD"],
    medications: ["Tiotropium", "Budesonide-formoterol"],
    lastSeen: "Apr 22",
    issues: [],
  },
]

/** highest-severity issue for a patient, or null if healthy */
export function topSeverity(patient: Patient): Severity | null {
  if (patient.issues.length === 0) return null
  return patient.issues.reduce<Severity>((acc, issue) => {
    return SEVERITY_RANK[issue.severity] < SEVERITY_RANK[acc] ? issue.severity : acc
  }, "routine")
}

/** every open issue across all patients, ranked for the Loop panel */
export function allIssuesRanked(): Issue[] {
  return patients
    .flatMap((p) => p.issues)
    .sort((a, b) => {
      const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
      if (bySeverity !== 0) return bySeverity
      return b.ageDays - a.ageDays
    })
}

/** patients sorted: most severe first, healthy patients last */
export function patientsRanked(): Patient[] {
  return [...patients].sort((a, b) => {
    const sa = topSeverity(a)
    const sb = topSeverity(b)
    const ra = sa ? SEVERITY_RANK[sa] : 99
    const rb = sb ? SEVERITY_RANK[sb] : 99
    if (ra !== rb) return ra - rb
    return b.issues.length - a.issues.length
  })
}

export function findIssue(id: string): Issue | undefined {
  return patients.flatMap((p) => p.issues).find((i) => i.id === id)
}

function normalizePatientRef(ref: string): string {
  return ref.replace(/^Patient\//, "").toLowerCase()
}

/** Issues for the Loop embed — filters by CDS patient context when possible. */
export function issuesForEmbed(patientId?: string | null): Issue[] {
  const ranked = allIssuesRanked()
  if (!patientId) return ranked

  const needle = normalizePatientRef(patientId)
  const matched = ranked.filter((issue) => {
    const hay = normalizePatientRef(issue.patientId)
    return hay === needle || hay.includes(needle) || needle.includes(hay)
  })

  return matched.length > 0 ? matched : ranked
}

export function patientForEmbed(patientId?: string | null): Patient | undefined {
  if (!patientId) return undefined
  const needle = normalizePatientRef(patientId)
  return patients.find((p) => {
    const hay = normalizePatientRef(p.id)
    return hay === needle || hay.includes(needle) || needle.includes(hay)
  })
}
