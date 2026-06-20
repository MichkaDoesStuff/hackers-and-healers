"use client"

import { useEffect } from "react"
import { Lock, X } from "lucide-react"
import type { Issue } from "@/lib/types"
import { severityDot, severityLabel } from "@/lib/severity"
import { cn } from "@/lib/utils"
import { WorkflowCanvas } from "./workflow-canvas"

export function WorkflowOverlay({
  issue,
  onClose,
}: {
  issue: Issue | null
  onClose: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    if (issue) window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [issue, onClose])

  if (!issue) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        {/* simulated embedded SMART/CDS app chrome */}
        <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2">
          <Lock className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            loop.app/workflow/{issue.id} · embedded in ClinicOS
          </span>
          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {issue.source}
          </span>
          <button
            onClick={onClose}
            className="ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close workflow"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* issue context header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn("size-2.5 rounded-full", severityDot[issue.severity])} />
              <h2 className="text-lg font-semibold text-foreground">{issue.title}</h2>
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                {severityLabel[issue.severity]}
              </span>
            </div>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {issue.detail}
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div className="font-medium text-foreground">{issue.patientName}</div>
            <div>open {issue.ageDays}d</div>
          </div>
        </div>

        {/* the react flow canvas */}
        <div className="relative min-h-0 flex-1">
          <WorkflowCanvas issue={issue} />
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <p className="text-xs text-muted-foreground">
            Drag to connect steps · use the palette to add steps · scroll to zoom
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-border px-3.5 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
            >
              Close
            </button>
            <button className="rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
              Run workflow
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
