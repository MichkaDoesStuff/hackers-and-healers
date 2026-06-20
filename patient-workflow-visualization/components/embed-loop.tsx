"use client"

import { useEffect, useMemo, useState } from "react"
import { Lock } from "lucide-react"
import { useSearchParams } from "next/navigation"
import type { Issue, Patient } from "@/lib/types"
import { issuesForEmbed, patientForEmbed } from "@/lib/data"
import { fetchClinic } from "@/lib/api"
import { parseCdsEmbedContext, formatFhirPatientRef } from "@/lib/cds-context"
import { LoopPanel } from "./loop-panel"
import { WorkflowOverlay } from "./workflow/workflow-overlay"

export function EmbedLoop() {
  const searchParams = useSearchParams()
  const context = useMemo(
    () => parseCdsEmbedContext(Object.fromEntries(searchParams.entries())),
    [searchParams],
  )

  const [patients, setPatients] = useState<Patient[]>([])
  const [openIssue, setOpenIssue] = useState<Issue | null>(null)

  useEffect(() => {
    fetchClinic()
      .then((d) => setPatients(d.patients))
      .catch(() => setPatients([]))
  }, [])

  const issues = useMemo(() => issuesForEmbed(patients, context.patientId), [patients, context.patientId])
  const patient = useMemo(() => patientForEmbed(patients, context.patientId), [patients, context.patientId])

  const patientRef = formatFhirPatientRef(context.patientId)
  const showingDemoFallback = Boolean(context.patientId && !patient && issues.length > 0)

  return (
    <div className="flex h-dvh flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2.5">
        <Lock className="size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">
            loop.app/embed · opened from CDS Hooks Sandbox
          </p>
          {patientRef && (
            <p className="truncate text-[11px] text-muted-foreground/80">
              Chart context: {patientRef}
              {patient ? ` · ${patient.name}` : ""}
            </p>
          )}
        </div>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {context.hook ?? "patient-view"}
        </span>
      </div>

      {showingDemoFallback && (
        <p className="border-b border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          Sandbox patient is not mapped to live data yet — showing all open loops.
        </p>
      )}

      <div className="min-h-0 flex-1">
        <LoopPanel
          issues={issues}
          onOpen={setOpenIssue}
          subtitle={
            patient
              ? `Open loops for ${patient.name}`
              : "Ranked open loops from your CDS session"
          }
          className="h-full w-full border-l-0 lg:w-full"
        />
      </div>

      <WorkflowOverlay issue={openIssue} onClose={() => setOpenIssue(null)} />
    </div>
  )
}
