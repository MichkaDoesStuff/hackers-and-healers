import type { Patient } from "./types"
import type { BackendLoop } from "./map-loops"

/** Same-origin proxy via Next.js rewrites → Loop backend `/api/*`. */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? ""

export interface ClinicResponse {
  patients: Patient[]
  open: number
}

export interface LoopsResponse {
  open: number
  patient: string | null
  patient_name: string | null
  loops: BackendLoop[]
}

export interface PlaybookStep {
  id: string
  kind: string
  title: string
  detail: string
  actor?: string
  prompt?: string | null
  gated?: boolean
}

export interface Playbook {
  id: string
  title: string
  description?: string
  loop_type: string
  version: number
  builtin?: boolean
  steps: PlaybookStep[]
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

/** Scoped loop detection for one patient — preferred for embed. */
export async function fetchLoops(
  patientId: string,
  timeoutMs = 8_000,
): Promise<LoopsResponse> {
  const id = patientId.replace(/^Patient\//, "")
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${API_BASE}/api/loops?patient=${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Loops load failed: ${res.status}`)
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

export async function fetchPlaybooks(loopType?: string): Promise<Playbook[]> {
  const q = loopType ? `?loop_type=${encodeURIComponent(loopType)}` : ""
  const res = await fetch(`${API_BASE}/api/playbooks${q}`, { cache: "no-store" })
  if (!res.ok) throw new Error(`Playbooks load failed: ${res.status}`)
  const data = await res.json()
  return data.playbooks ?? []
}

export async function draftLoop(
  loopId: string,
  playbookId?: string,
): Promise<{ draft: string; model: string; loop_id: string }> {
  const res = await fetch(`${API_BASE}/api/loops/${encodeURIComponent(loopId)}/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(playbookId ? { playbook_id: playbookId } : {}),
  })
  if (!res.ok) throw new Error(`Draft failed: ${res.status}`)
  return res.json()
}

export interface ApproveResult {
  status: string
  written?: Array<{ resourceType: string; id: string }>
  loop_id: string
  closed?: boolean
  model?: string
  message?: string
}

export async function approveLoop(
  loopId: string,
  body: { message?: string; playbook_id?: string; approver?: string } = {},
): Promise<ApproveResult> {
  const res = await fetch(`${API_BASE}/api/loops/${encodeURIComponent(loopId)}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Approve failed: ${res.status}`)
  return res.json()
}

/** @deprecated use draftLoop */
export async function draftLoopMessage(loopId: string, prompt?: string): Promise<{ text: string; model: string }> {
  const res = await draftLoop(loopId)
  return { text: res.draft, model: res.model }
}

/* ---- workflow builder: save user-defined playbooks + Twilio notify ---- */

export interface SavePlaybookStep {
  id: string
  kind: string
  title: string
  detail?: string
  actor?: string
  prompt?: string | null
  gated?: boolean
  x?: number
  y?: number
  config?: Record<string, unknown>
}

export interface SavePlaybookInput {
  id?: string
  title: string
  description?: string
  loop_type: string
  steps: SavePlaybookStep[]
  edges: { source: string; target: string; label?: string }[]
}

/** Persist a workflow built on the canvas as a reusable playbook. */
export async function savePlaybook(input: SavePlaybookInput): Promise<Playbook & { id: string }> {
  const res = await fetch(`${API_BASE}/api/playbooks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: input.id ?? "",
      title: input.title,
      description: input.description ?? "",
      loop_type: input.loop_type,
      version: 1,
      builtin: false,
      steps: input.steps,
      edges: input.edges,
    }),
  })
  if (!res.ok) throw new Error(`Save failed: ${res.status}`)
  return res.json()
}

/** Twilio SMS for a notify node — simulated unless the backend has Twilio creds. */
export async function sendSms(
  to: string,
  body: string,
): Promise<{ sent: boolean; simulated?: boolean; sid?: string; note?: string; error?: string }> {
  const res = await fetch(`${API_BASE}/api/notify/sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, body }),
  })
  if (!res.ok) throw new Error(`SMS failed: ${res.status}`)
  return res.json()
}
