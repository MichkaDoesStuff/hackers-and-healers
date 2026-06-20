import type { Patient } from "./types"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

export interface ClinicResponse {
  patients: Patient[]
  open: number
}

/** Live clinic data (patients + issues) from the Loop backend, detected on FHIR. */
export async function fetchClinic(): Promise<ClinicResponse> {
  const res = await fetch(`${API_BASE}/api/clinic`, { cache: "no-store" })
  if (!res.ok) throw new Error(`Clinic load failed: ${res.status}`)
  return res.json()
}

/** SMART launch patient context, if the EMR launched us in a chart. */
export function launchPatient(): string | null {
  if (typeof window === "undefined") return null
  return new URLSearchParams(window.location.search).get("patient")
}
