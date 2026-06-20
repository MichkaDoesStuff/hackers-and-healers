"use client"

import type { Issue } from "@/lib/types"
import { IssueCard } from "./issue-card"

export function LoopPanel({
  issues,
  onOpen,
  scopedName,
  subtitle = "Signed in as your ClinicOS session",
  className,
  compact = false,
}: {
  issues: Issue[]
  onOpen: (issue: Issue) => void
  scopedName?: string | null
  subtitle?: string
  className?: string
  compact?: boolean
}) {
  return (
    <aside className={className ?? "flex w-full flex-col border-l border-border lg:w-[420px]"}>
      <div
        className={
          compact
            ? "flex items-baseline justify-between px-3 pb-2 pt-3"
            : "flex items-baseline justify-between px-5 pb-3 pt-5"
        }
      >
        {!compact && (
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Loop</h2>
        )}
        {compact ? (
          <p className="text-sm font-medium text-foreground">Open loops</p>
        ) : null}
        <span className="text-sm text-muted-foreground">{issues.length} open</span>
      </div>

      <p
        className={
          compact
            ? "px-3 pb-3 text-xs text-muted-foreground"
            : "px-5 pb-4 text-sm text-muted-foreground"
        }
      >
        {scopedName ? "Launched in chart · SMART on FHIR" : subtitle}
      </p>

      {scopedName && !compact && (
        <div className="mx-5 mb-3 flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2">
          <span className="rounded border border-ring/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ring">
            In chart
          </span>
          <span className="text-sm font-semibold text-foreground">{scopedName}</span>
        </div>
      )}

      <div
        className={
          compact
            ? "flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3"
            : "flex flex-1 flex-col gap-2.5 overflow-y-auto px-5 pb-5"
        }
      >
        {issues.map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            onOpen={onOpen}
            showPatient={!compact}
            compact={compact}
          />
        ))}
        {issues.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No open loops. All clear.</p>
        )}
      </div>
    </aside>
  )
}
