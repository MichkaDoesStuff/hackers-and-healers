"use client"

import type { Issue } from "@/lib/types"
import { LohopMark } from "./lohop-mark"
import { IssueCard } from "./issue-card"

export function LoopPanel({
  issues,
  onOpen,
  scopedName,
  patientName,
  subtitle = "Ranked by urgency — clinician approves every action",
  className,
  compact = false,
  loading = false,
}: {
  issues: Issue[]
  onOpen: (issue: Issue) => void
  scopedName?: string | null
  patientName?: string | null
  subtitle?: string
  className?: string
  compact?: boolean
  loading?: boolean
}) {
  const displayPatient = patientName ?? scopedName

  if (compact) {
    return (
      <aside className={className ?? "flex w-full flex-col bg-card"}>
        <header className="shrink-0 border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <LohopMark size="sm" />
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              {loading ? "…" : `${issues.length} open`}
            </span>
          </div>
          {displayPatient ? (
            <p className="mt-1.5 truncate text-sm font-medium text-foreground">{displayPatient}</p>
          ) : (
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && issues.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              Scanning chart for open loops…
            </div>
          ) : issues.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-foreground">All clear</p>
              <p className="mt-1 text-xs text-muted-foreground">No open loops for this patient.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {issues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  onOpen={onOpen}
                  compact
                  variant="list"
                />
              ))}
            </div>
          )}
        </div>
      </aside>
    )
  }

  return (
    <aside className={className ?? "flex w-full flex-col border-l border-border lg:w-[420px]"}>
      <div className="flex items-baseline justify-between px-5 pb-2 pt-5">
        <LohopMark size="lg" showTagline />
        <span className="text-sm text-muted-foreground">{issues.length} open</span>
      </div>

      <p className="px-5 pb-4 text-sm text-muted-foreground">
        {scopedName ? "Launched in chart · SMART on FHIR" : subtitle}
      </p>

      {scopedName && (
        <div className="mx-5 mb-3 flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2">
          <span className="rounded border border-ring/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ring">
            In chart
          </span>
          <span className="text-sm font-semibold text-foreground">{scopedName}</span>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-5 pb-5">
        {issues.map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            onOpen={onOpen}
            showPatient
            variant="card"
          />
        ))}
        {issues.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No open loops. All clear.</p>
        )}
      </div>
    </aside>
  )
}
