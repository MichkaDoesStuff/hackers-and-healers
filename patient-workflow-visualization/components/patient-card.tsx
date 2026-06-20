"use client"

import { Check } from "lucide-react"
import type { Issue, Patient } from "@/lib/types"
import { topSeverity, SEVERITY_RANK } from "@/lib/data"
import { severityDot, severityLabel } from "@/lib/severity"
import { cn } from "@/lib/utils"
import { IssueCard } from "./issue-card"

export function PatientCard({
  patient,
  onOpen,
}: {
  patient: Patient
  onOpen: (issue: Issue) => void
}) {
  const sev = topSeverity(patient)
  const healthy = sev === null
  const sortedIssues = [...patient.issues].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.ageDays - a.ageDays,
  )

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-colors",
        healthy ? "border-border bg-card/40" : "border-border bg-card/70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "size-2.5 shrink-0 rounded-full",
                healthy ? "bg-healthy" : severityDot[sev],
              )}
            />
            <h3 className="truncate text-[17px] font-semibold text-foreground">{patient.name}</h3>
          </div>
          <p className="mt-1 pl-5 text-sm text-muted-foreground">
            {patient.age > 0 ? `${patient.age}${patient.sex}` : "Claims"} · {patient.mrn} · seen {patient.lastSeen}
          </p>
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
            healthy
              ? "bg-healthy-surface/25 text-healthy-foreground"
              : sev === "critical"
                ? "bg-critical-surface/35 text-critical-foreground"
                : sev === "warning"
                  ? "bg-warning-surface/30 text-warning-foreground"
                  : "bg-muted text-muted-foreground",
          )}
        >
          {healthy ? "All clear" : severityLabel[sev]}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 pl-5">
        {patient.conditions.map((c) => (
          <span
            key={c}
            className="rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
          >
            {c}
          </span>
        ))}
      </div>

      {healthy ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-healthy-surface/30 bg-healthy-surface/10 px-3.5 py-2.5">
          <Check className="size-4 text-healthy" />
          <span className="text-sm text-healthy-foreground">No open loops — nothing falling through the cracks.</span>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {sortedIssues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  )
}
