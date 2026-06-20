"use client"

import { ChevronRight } from "lucide-react"
import type { Issue } from "@/lib/types"
import {
  formatAgeDays,
  severityAccent,
  severityDot,
  severityLabel,
  severitySurface,
  severityText,
} from "@/lib/severity"
import { cn } from "@/lib/utils"

export function IssueCard({
  issue,
  onOpen,
  showPatient = false,
  compact = false,
  variant = compact ? "list" : "card",
}: {
  issue: Issue
  onOpen: (issue: Issue) => void
  showPatient?: boolean
  compact?: boolean
  variant?: "list" | "card"
}) {
  if (variant === "list") {
    return (
      <button
        type="button"
        onClick={() => onOpen(issue)}
        className={cn(
          "group flex w-full items-start gap-3 border-l-[3px] py-3 pl-3 pr-2 text-left transition-colors hover:bg-accent/50",
          severityAccent[issue.severity],
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-snug text-foreground">
              {issue.title}
            </p>
            <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">
              {formatAgeDays(issue.ageDays)}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {issue.summary}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide",
                severityText[issue.severity],
              )}
            >
              <span className={cn("size-1.5 rounded-full", severityDot[issue.severity])} />
              {severityLabel[issue.severity]}
            </span>
            {issue.category && (
              <span className="text-[10px] text-muted-foreground">{issue.category}</span>
            )}
          </div>
        </div>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(issue)}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
        severitySurface[issue.severity],
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-full", severityDot[issue.severity])} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold leading-tight text-foreground">
          {showPatient && issue.patientName !== issue.title ? `${issue.patientName} — ` : ""}
          {issue.title}
        </div>
        <div className="mt-0.5 truncate text-sm text-muted-foreground">{issue.summary}</div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}
