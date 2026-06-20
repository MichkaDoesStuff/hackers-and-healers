"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles, Loader2, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface Extraction {
  patient_name: string
  diagnosis: string
  specialist: string
  urgency: string
  model: string
}
interface Task {
  taskId: string
  patientId: string
  patientName: string
  faxText: string
  extraction: Extraction
  status: string
  written?: { resourceType: string; id: string }[]
}

const urgencyTone: Record<string, string> = {
  emergent: "border-critical/40 bg-critical-surface/40 text-critical-foreground",
  urgent: "border-warning/40 bg-warning-surface/40 text-warning-foreground",
  routine: "border-border bg-muted text-muted-foreground",
}

export default function ReviewPortal() {
  const { taskId } = useParams<{ taskId: string }>()
  const router = useRouter()
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [written, setWritten] = useState<Task["written"] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!taskId) return
    fetch(`/api/triage/tasks/${taskId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Load failed (${r.status})`))))
      .then((d: Task) => {
        setTask(d)
        if (d.status === "approved") setWritten(d.written ?? [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [taskId])

  async function approve() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/triage/tasks/${taskId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approver: "Dr. Chen" }),
      })
      if (!res.ok) throw new Error(`Approve failed (${res.status})`)
      const data = await res.json()
      setWritten(data.written ?? [])
      setTask((t) => (t ? { ...t, status: "approved" } : t))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed")
    } finally {
      setSaving(false)
    }
  }

  const ex = task?.extraction
  const approved = task?.status === "approved"

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/triage")}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Back to inbox"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Smart Triage Review</h1>
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading…" : `${task?.patientName} · ${task?.patientId}`}
            </p>
          </div>
          <span className="ml-2 hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground sm:flex">
            <ShieldCheck className="size-3.5" /> Privacy by design
          </span>
        </div>
        <button
          onClick={approve}
          disabled={saving || approved || loading}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          {approved ? "Approved" : saving ? "Writing to FHIR…" : "Approve & write to FHIR"}
        </button>
      </header>

      {error && (
        <div className="border-b border-critical/30 bg-critical-surface/30 px-6 py-2 text-sm text-critical-foreground">
          {error}
        </div>
      )}
      {approved && written && (
        <div className="border-b border-border bg-healthy-surface/20 px-6 py-2 text-sm">
          ✓ Referral written to FHIR: {written.map((w) => `${w.resourceType}/${w.id}`).join(" · ")}
        </div>
      )}

      <main className="flex flex-1 flex-col gap-5 p-6 lg:flex-row">
        {/* Left: original fax */}
        <section className="flex flex-1 flex-col rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 rounded-t-xl border-b border-border bg-muted/50 px-4 py-3 text-sm font-medium">
            <FileText className="size-4 text-muted-foreground" /> Original document (incoming fax)
          </div>
          <pre className="flex-1 overflow-auto whitespace-pre-wrap px-5 py-4 font-mono text-[13px] leading-relaxed text-foreground/90">{loading ? "Loading fax…" : task?.faxText}</pre>
        </section>

        {/* Right: extracted fields */}
        <section className="flex flex-1 flex-col rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between rounded-t-xl border-b border-border bg-primary/5 px-4 py-3 text-sm font-medium">
            <span className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> AI-extracted data
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {ex?.model === "fallback" ? "deterministic" : (ex?.model ?? "—")}
            </span>
          </div>
          <div className="flex-1 space-y-5 px-5 py-5">
            <Field label="Patient name" value={loading ? "…" : ex?.patient_name} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Specialist" value={loading ? "…" : ex?.specialist} accent />
              <div>
                <Label>Urgency</Label>
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium capitalize",
                    urgencyTone[ex?.urgency ?? "routine"],
                  )}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {loading ? "…" : ex?.urgency}
                </div>
              </div>
            </div>
            <div>
              <Label>Clinical reason / diagnosis</Label>
              <textarea
                readOnly
                value={loading ? "…" : (ex?.diagnosis ?? "")}
                className="min-h-[110px] w-full resize-none rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The model only reads the fax into fields — it never sets the referral or writes to
              FHIR. That requires your approval above (a non-removable gate).
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  )
}

function Field({ label, value, accent }: { label: string; value?: string; accent?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <div
        className={cn(
          "rounded-md border px-3 py-2 text-sm font-medium",
          accent ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30",
        )}
      >
        {value}
      </div>
    </div>
  )
}
