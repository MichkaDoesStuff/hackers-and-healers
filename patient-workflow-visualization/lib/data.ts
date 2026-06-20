import type { Issue, Patient, Severity } from "./types"

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  routine: 2,
}

/** highest-severity issue for a patient, or null if healthy */
export function topSeverity(patient: Patient): Severity | null {
  if (patient.issues.length === 0) return null
  return patient.issues.reduce<Severity>((acc, issue) => {
    return SEVERITY_RANK[issue.severity] < SEVERITY_RANK[acc] ? issue.severity : acc
  }, "routine")
}

/** every open issue across all patients, ranked for the Loop panel */
export function allIssuesRanked(patients: Patient[]): Issue[] {
  return patients
    .flatMap((p) => p.issues)
    .sort((a, b) => {
      const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
      if (bySeverity !== 0) return bySeverity
      return b.ageDays - a.ageDays
    })
}

/** patients sorted: most severe first, healthy patients last */
export function patientsRanked(patients: Patient[]): Patient[] {
  return [...patients].sort((a, b) => {
    const sa = topSeverity(a)
    const sb = topSeverity(b)
    const ra = sa ? SEVERITY_RANK[sa] : 99
    const rb = sb ? SEVERITY_RANK[sb] : 99
    if (ra !== rb) return ra - rb
    return b.issues.length - a.issues.length
  })
}
