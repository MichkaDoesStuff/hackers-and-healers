"use client"

import type { Issue } from "@/lib/types"
import { IssueCard } from "./issue-card"

export function LoopPanel({
  issues,
  onOpen,
  subtitle = "Signed in as your ClinicOS session",
  className,
}: {
  issues: Issue[]
  onOpen: (issue: Issue) => void
  subtitle?: string
  className?: string
}) {
  return (
    <aside className={className ?? "flex w-full flex-col border-l border-border lg:w-[420px]"}>
      <div className="flex items-baseline justify-between px-5 pb-3 pt-5">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Loop</h2>
        <span className="text-sm text-muted-foreground">{issues.length} open</span>
      </div>
      <p className="px-5 pb-4 text-sm text-muted-foreground">{subtitle}</p>

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-5 pb-5">
        {issues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} onOpen={onOpen} showPatient />
        ))}
      </div>
    </aside>
  )
}
