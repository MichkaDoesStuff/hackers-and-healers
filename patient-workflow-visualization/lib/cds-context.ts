/**
 * CDS Hooks embed context.
 *
 * When Loop is opened from the CDS Hooks sandbox (as an iframe / SMART link), the
 * launching context arrives as query params. We read the patient id and hook so the
 * embed can scope to the open chart.
 */
export interface CdsEmbedContext {
  patientId: string | null
  hook: string | null
}

/** Parse the embed context from URL query params (CDS Hooks / SMART launch style). */
export function parseCdsEmbedContext(params: Record<string, string>): CdsEmbedContext {
  const patientId =
    params.patient ?? params.patientId ?? params.patient_id ?? null
  const hook = params.hook ?? params.hookType ?? null
  return { patientId, hook }
}

/** Render a patient id as a FHIR reference, e.g. "Patient/123". */
export function formatFhirPatientRef(patientId?: string | null): string | null {
  if (!patientId) return null
  return patientId.startsWith("Patient/") ? patientId : `Patient/${patientId}`
}
