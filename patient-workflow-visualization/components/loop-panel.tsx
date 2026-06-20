"use client"

import type { Issue } from "@/lib/types"
import { IssueCard } from "./issue-card"

export function LoopPanel({
  issues,
  onOpen,
  scopedName,
  subtitle = "Signed in as your ClinicOS session",
  className,
}: {
  issues: Issue[]
  onOpen: (issue: Issue) => void
  scopedName?: string | null
  subtitle?: string
  className?: string
}) {
  return (
    <aside className={className ?? "flex w-full flex-col border-l border-border lg:w-[420px]"}>
      <div className="flex items-baseline justify-between px-5 pb-3 pt-5">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Loop</h2>
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
          <a href={typeof window !== "undefined" ? window.location.pathname : "/"} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
            View all →
          </a>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-5 pb-5">
        {issues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} onOpen={onOpen} showPatient />
        ))}
        {issues.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No open loops. All clear.</p>
        )}
      </div>
    </aside>
  )
}
