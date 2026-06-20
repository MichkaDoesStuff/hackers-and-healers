import type { Patient } from "./types"

/** Same-origin proxy via Next.js rewrites → Loop backend `/api/*`. */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? ""

export interface ClinicResponse {
  patients: Patient[]
  open: number
}

/** Live clinic data (patients + issues) from the Loop backend, detected on FHIR. */
export async function fetchClinic(): Promise<ClinicResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const res = await fetch(`${API_BASE}/api/clinic`, {
      cache: "no-store",
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Clinic load failed: ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(timeout)
  }
}

/** SMART launch patient context, if the EMR launched us in a chart. */
export function launchPatient(): string | null {
  if (typeof window === "undefined") return null
  return new URLSearchParams(window.location.search).get("patient")
}

/** Draft clinician message for a loop via the Loop backend LLM. */
export async function draftLoopMessage(loopId: string, prompt?: string): Promise<{ text: string; model: string }> {
  const res = await fetch(`${API_BASE}/api/loops/${encodeURIComponent(loopId)}/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prompt ? { prompt } : {}),
  })
  if (!res.ok) throw new Error(`Draft failed: ${res.status}`)
  return res.json()
}
