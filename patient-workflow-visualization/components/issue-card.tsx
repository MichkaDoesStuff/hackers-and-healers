"use client"

import { ChevronRight } from "lucide-react"
import type { Issue } from "@/lib/types"
import { severityDot, severitySurface, severityText } from "@/lib/severity"
import { cn } from "@/lib/utils"

export function IssueCard({
  issue,
  onOpen,
  showPatient = false,
  compact = false,
}: {
  issue: Issue
  onOpen: (issue: Issue) => void
  showPatient?: boolean
  compact?: boolean
}) {
  return (
    <button
      onClick={() => onOpen(issue)}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-xl border text-left transition-colors",
        compact ? "px-3 py-2.5" : "gap-3 px-3.5 py-3",
        severitySurface[issue.severity],
      )}
    >
      <span className={cn("mt-1.5 size-2 shrink-0 self-start rounded-full", severityDot[issue.severity])} />
      <div className="min-w-0 flex-1">
        <div className={cn("truncate font-semibold leading-tight", compact ? "text-sm" : "text-[15px]", severityText[issue.severity])}>
          {showPatient && issue.patientName !== issue.title ? `${issue.patientName} — ` : ""}
          {issue.title}
        </div>
        <div className="mt-0.5 truncate text-sm text-muted-foreground">{issue.summary}</div>
      </div>
      <ChevronRight
        className={cn(
          "size-4 shrink-0 transition-transform group-hover:translate-x-0.5",
          severityText[issue.severity],
        )}
      />
    </button>
  )
}
