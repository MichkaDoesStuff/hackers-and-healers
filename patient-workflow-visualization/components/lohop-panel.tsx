"use client"

import type { Issue } from "@/lib/types"
import { IssueCard } from "./issue-card"

export function LohopPanel({
  issues,
  onOpen,
  subtitle = "Signed in as your Lohop session",
  className,
}: {
  issues: Issue[]
  onOpen: (issue: Issue) => void
  subtitle?: string
  className?: string
}) {
  return (
    <aside className={(className ?? "flex w-full flex-col lg:w-[420px]") + " paper-texture"}>
      <div className="flex flex-col border-l border-border bg-ruled scroll-fade h-full">
        <div className="flex items-baseline justify-between px-5 pb-3 pt-5">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Lohop</h2>
          <span className="text-sm text-muted-foreground">{issues.length} open</span>
        </div>
        <p className="px-5 pb-4 text-sm text-muted-foreground">{subtitle}</p>
        <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-5 paper-stack space-y-2">
          {issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} onOpen={onOpen} showPatient />
          ))}
        </div>
      </div>
    </aside>
  )
}
