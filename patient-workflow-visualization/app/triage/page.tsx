"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Inbox, ScanLine, ArrowRight, Loader2, FileText, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

interface TaskRow {
  taskId: string
  patientName: string
  patientId: string
  extraction: { specialist: string; urgency: string }
  status: string
}

const urgencyDot: Record<string, string> = {
  emergent: "bg-critical",
  urgent: "bg-warning",
  routine: "bg-muted-foreground/50",
}

export default function TriageInbox() {
  const router = useRouter()
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch("/api/triage/tasks", { cache: "no-store" })
      const data = await res.json()
      setTasks(data.tasks ?? [])
    } catch {
      /* empty inbox is fine */
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function scan() {
    setScanning(true)
    setError(null)
    try {
      const res = await fetch("/api/triage/scan", { method: "POST" })
      if (!res.ok) throw new Error(`Scan failed (${res.status})`)
      const task = await res.json()
      router.push(`/review/${task.taskId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed")
      setScanning(false)
    }
  }

  const pending = tasks.filter((t) => t.status !== "approved").length

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Inbox className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Fax Triage Inbox</h1>
            <p className="text-sm text-muted-foreground">
              Unstructured faxes → AI-extracted referrals → your approval
            </p>
          </div>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground sm:flex">
          <ShieldCheck className="size-3.5" /> Synthetic data · local
        </span>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <button
          onClick={scan}
          disabled={scanning}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card py-5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
        >
          {scanning ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ScanLine className="size-4 text-primary" />
          )}
          {scanning ? "Scanning incoming fax…" : "Scan next incoming fax"}
        </button>
        {error && <p className="mt-3 text-sm text-critical-foreground">{error}</p>}

        <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Faxes ({pending} pending)
        </h2>

        <ul className="space-y-2">
          {tasks.length === 0 && (
            <li className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              No faxes yet — scan one to see the AI extraction.
            </li>
          )}
          {tasks.map((t) => (
            <li key={t.taskId}>
              <button
                onClick={() => router.push(`/review/${t.taskId}`)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{t.patientName}</span>
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        urgencyDot[t.extraction?.urgency] ?? "bg-muted-foreground/50",
                      )}
                    />
                    <span className="text-xs text-muted-foreground">{t.extraction?.specialist}</span>
                  </div>
                  <span className="text-xs capitalize text-muted-foreground">
                    {t.extraction?.urgency} · {t.status}
                  </span>
                </div>
                {t.status === "approved" ? (
                  <span className="rounded-full bg-healthy-surface/40 px-2 py-0.5 text-xs">Approved</span>
                ) : (
                  <ArrowRight className="size-4 text-muted-foreground" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
