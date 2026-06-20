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
  compact = false,
}: {
  issue: Issue | null
  onClose: () => void
  compact?: boolean
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
    <div
      className={cn(
        "fixed inset-0 z-50 flex bg-foreground/25 backdrop-blur-sm",
        compact ? "items-stretch p-0" : "items-center justify-center p-3 sm:p-6",
      )}
    >
      <div
        className={cn(
          "flex h-full w-full flex-col overflow-hidden border border-border bg-background shadow-2xl",
          compact ? "rounded-none" : "max-w-6xl rounded-2xl",
        )}
      >
        {/* simulated embedded SMART/CDS app chrome */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-2">
          <Lock className="size-3 text-muted-foreground" />
          <span className="truncate text-xs text-muted-foreground">
            {compact ? "Workflow" : `loop.app/workflow/${issue.id} · embedded in ClinicOS`}
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
        <div
          className={cn(
            "flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-border",
            compact ? "px-3 py-2.5" : "gap-3 px-5 py-4",
          )}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={cn("size-2 shrink-0 rounded-full", severityDot[issue.severity])} />
              <h2 className={cn("font-semibold text-foreground", compact ? "text-base" : "text-lg")}>
                {issue.title}
              </h2>
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

        <div className={cn("flex shrink-0 items-center justify-between border-t border-border", compact ? "px-3 py-2" : "px-5 py-3")}>
          {!compact && (
            <p className="text-xs text-muted-foreground">
              Drag to connect steps · use the palette to add steps · scroll to zoom
            </p>
          )}
          <div className={cn("flex gap-2", compact && "ml-auto w-full justify-end")}>
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
