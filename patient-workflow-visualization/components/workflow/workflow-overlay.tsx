"use client"

import { useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import type { Issue } from "@/lib/types"
import { severityDot, severityLabel } from "@/lib/severity"
import { cn } from "@/lib/utils"
import { WorkflowRunner } from "./workflow-runner"
import { WorkflowCanvas } from "./workflow-canvas"

export function WorkflowOverlay({
  issue,
  onClose,
  closeHref,
  compact = false,
}: {
  issue: Issue | null
  onClose?: () => void
  /** Plain navigation close — works without React hydration (embed iframe). */
  closeHref?: string
  compact?: boolean
}) {
  const [mode, setMode] = useState<"build" | "run">("build")
  if (!issue) return null

  const closeButton = closeHref ? (
    <Link
      href={closeHref}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      aria-label="Close workflow"
    >
      <X className="size-5" />
    </Link>
  ) : (
    <button
      type="button"
      onClick={onClose}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      aria-label="Close workflow"
    >
      <X className="size-5" />
    </button>
  )

  const footerClose = closeHref ? (
    <Link
      href={closeHref}
      className="rounded-lg border border-border px-3.5 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
    >
      Close
    </Link>
  ) : (
    <button
      type="button"
      onClick={onClose}
      className="rounded-lg border border-border px-3.5 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
    >
      Close
    </button>
  )

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex bg-black/20 backdrop-blur-[2px]",
        compact ? "items-stretch p-0" : "items-center justify-center p-3 sm:p-6",
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Workflow"
    >
      <div
        className={cn(
          "flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl",
          compact ? "rounded-none" : "max-h-[92vh] max-w-3xl rounded-2xl border border-slate-200",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-white",
            compact ? "px-3 py-2.5" : "px-5 py-4",
          )}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("size-2 shrink-0 rounded-full", severityDot[issue.severity])} />
              <h2 className={cn("font-semibold text-slate-900", compact ? "text-base" : "text-lg")}>
                {issue.title}
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {severityLabel[issue.severity]}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">{issue.detail}</p>
          </div>
          {closeButton}
        </div>

        <div className="flex shrink-0 items-center gap-1 border-b border-slate-100 bg-white px-3 py-1.5">
          <button
            type="button"
            onClick={() => setMode("build")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              mode === "build" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100",
            )}
          >
            Build
          </button>
          <button
            type="button"
            onClick={() => setMode("run")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              mode === "run" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100",
            )}
          >
            Run
          </button>
          <span className="ml-2 truncate text-[11px] text-slate-400">
            {mode === "build"
              ? "Drag to connect · click a node to edit · Save workflow"
              : "Run draft → approve → write-back"}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          {mode === "build" ? (
            <WorkflowCanvas key={issue.id} issue={issue} />
          ) : (
            <WorkflowRunner issue={issue} compact={compact} />
          )}
        </div>

        {compact && (
          <div className="flex shrink-0 justify-end border-t border-slate-100 px-3 py-2">
            {footerClose}
          </div>
        )}
      </div>
    </div>
  )
}
