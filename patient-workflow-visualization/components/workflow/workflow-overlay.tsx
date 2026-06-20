"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import type { Issue } from "@/lib/types"
import { severityDot, severityLabel } from "@/lib/severity"
import { cn } from "@/lib/utils"
import { WorkflowRunner } from "./workflow-runner"

export function WorkflowOverlay({
  issue,
  onClose,
  compact = false,
}: {
  issue: Issue | null
  onClose: () => void
  compact?: boolean
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    if (issue) {
      window.addEventListener("keydown", onKey)
      document.body.style.overflow = "hidden"
    }
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [issue, onClose])

  if (!issue || !mounted) return null

  const overlay = (
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
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close workflow"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1">
          <WorkflowRunner issue={issue} compact={compact} />
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
