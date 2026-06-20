import type { Issue, Patient, Severity } from "./types"
import { sandboxIssuesForPatient } from "./sandbox-data"

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

/** Sort issues: critical first, then older loops within the same band. */
export function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    if (bySeverity !== 0) return bySeverity
    return b.ageDays - a.ageDays
  })
}

/** every open issue across all patients, ranked for the Loop panel */
export function allIssuesRanked(patients: Patient[]): Issue[] {
  return sortIssues(patients.flatMap((p) => p.issues))
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

export function findIssue(patients: Patient[], id: string): Issue | undefined {
  return patients.flatMap((p) => p.issues).find((i) => i.id === id)
}

function normalizePatientRef(ref: string): string {
  return ref.replace(/^Patient\//, "").toLowerCase()
}

/** Issues for the Loop embed — sandbox samples, then live backend data. */
export function issuesForEmbed(patients: Patient[], patientId?: string | null): Issue[] {
  const sandbox = sandboxIssuesForPatient(patientId)
  if (sandbox?.length) return sortIssues(sandbox)

  const ranked = allIssuesRanked(patients)
  if (!patientId) return ranked

  const needle = normalizePatientRef(patientId)
  const matched = ranked.filter((issue) => {
    const hay = normalizePatientRef(issue.patientId)
    return hay === needle || hay.includes(needle) || needle.includes(hay)
  })

  return matched.length > 0 ? matched : ranked.slice(0, 4)
}

export function patientForEmbed(patients: Patient[], patientId?: string | null): Patient | undefined {
  if (!patientId) return undefined
  const needle = normalizePatientRef(patientId)
  return patients.find((p) => {
    const hay = normalizePatientRef(p.id)
    return hay === needle || hay.includes(needle) || needle.includes(hay)
  })
}
