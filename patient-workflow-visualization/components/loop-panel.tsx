"use client"

import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react"
import type { Issue, Severity } from "@/lib/types"
import { sortIssues } from "@/lib/data"
import { severityDot, severityLabel } from "@/lib/severity"
import { cn } from "@/lib/utils"
import { LohopMark } from "./lohop-mark"
import { IssueCard } from "./issue-card"

/** small per-severity tally shown under the header */
function SeveritySummary({ issues }: { issues: Issue[] }) {
  const order: Severity[] = ["critical", "warning", "routine"]
  const counts = order
    .map((s) => ({ severity: s, count: issues.filter((i) => i.severity === s).length }))
    .filter((c) => c.count > 0)

  if (counts.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {counts.map(({ severity, count }) => (
        <span
          key={severity}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
        >
          <span className={cn("size-1.5 rounded-full", severityDot[severity])} />
          <span className="tabular-nums text-foreground">{count}</span>
          <span className="text-muted-foreground">{severityLabel[severity].toLowerCase()}</span>
        </span>
      ))}
    </div>
  )
}

export function LoopPanel({
  issues,
  onOpen,
  issueHref,
  scopedName,
  patientName,
  subtitle = "Ranked by urgency — clinician approves every action",
  className,
  compact = false,
  loading = false,
}: {
  issues: Issue[]
  onOpen: (issue: Issue) => void
  /** When set, issue rows navigate via link (works without JS hydration in iframe). */
  issueHref?: (issue: Issue) => string
  scopedName?: string | null
  patientName?: string | null
  subtitle?: string
  className?: string
  compact?: boolean
  loading?: boolean
}) {
  const displayPatient = patientName ?? scopedName
  const ranked = sortIssues(issues)

  if (compact) {
    return (
      <aside className={className ?? "flex w-full flex-col bg-card"}>
        <header className="shrink-0 border-b border-border px-4 pb-3 pt-3.5">
          <div className="flex items-center justify-between gap-2">
            <LohopMark size="sm" />
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
              {loading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <span className={cn("size-1.5 rounded-full", ranked.length ? "bg-warning" : "bg-healthy")} />
              )}
              {loading ? "scanning" : `${ranked.length} open`}
            </span>
          </div>

          {displayPatient ? (
            <p className="mt-2 truncate text-sm font-medium text-foreground">{displayPatient}</p>
          ) : null}

          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="size-3 shrink-0 text-ring" />
            <span className="truncate">Ranked by urgency · human in the loop</span>
          </div>

          {!loading && ranked.length > 0 && (
            <div className="mt-2.5">
              <SeveritySummary issues={ranked} />
            </div>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && ranked.length === 0 ? (
            <div className="flex flex-col items-center gap-2.5 px-4 py-12 text-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground">Scanning chart for open loops…</p>
            </div>
          ) : ranked.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <span className="flex size-9 items-center justify-center rounded-full bg-healthy-surface/30">
                <CheckCircle2 className="size-5 text-healthy" />
              </span>
              <p className="text-sm font-medium text-foreground">All clear</p>
              <p className="max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
                No open loops for this patient.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {ranked.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  onOpen={onOpen}
                  href={issueHref?.(issue)}
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
      <header className="shrink-0 px-5 pb-4 pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <LohopMark size="lg" showTagline />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[12px] font-medium tabular-nums text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", ranked.length ? "bg-warning" : "bg-healthy")} />
            {ranked.length} open
          </span>
        </div>

        <div className="mt-2.5 flex items-center gap-1.5 text-sm text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0 text-ring" />
          <span className="truncate">
            {scopedName ? "Launched in chart · ranked by urgency · human in the loop" : subtitle}
          </span>
        </div>

        {scopedName && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2">
            <span className="rounded border border-ring/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ring">
              In chart
            </span>
            <span className="truncate text-sm font-semibold text-foreground">{scopedName}</span>
          </div>
        )}

        {ranked.length > 0 && (
          <div className="mt-3">
            <SeveritySummary issues={ranked} />
          </div>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-5 pb-5">
        {ranked.map((issue) => (
          <IssueCard key={issue.id} issue={issue} onOpen={onOpen} showPatient variant="card" />
        ))}

        {ranked.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-healthy-surface/30">
              <CheckCircle2 className="size-5 text-healthy" />
            </span>
            <p className="text-sm font-medium text-foreground">No open loops</p>
            <p className="max-w-[18rem] text-xs leading-relaxed text-muted-foreground">
              Every loop has been closed. New ones will appear here ranked by urgency.
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
