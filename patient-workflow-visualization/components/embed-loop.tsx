"use client"

import { useEffect, useMemo, useState } from "react"
import { Lock } from "lucide-react"
import { useSearchParams } from "next/navigation"
import type { Issue, Patient } from "@/lib/types"
import { issuesForEmbed, patientForEmbed } from "@/lib/data"
import { fetchClinic } from "@/lib/api"
import { sandboxIssuesForPatient } from "@/lib/sandbox-data"
import { parseCdsEmbedContext, formatFhirPatientRef } from "@/lib/cds-context"
import { LoopPanel } from "./loop-panel"
import { WorkflowOverlay } from "./workflow/workflow-overlay"

function fhirPatientName(resource: Record<string, unknown>): string | null {
  const names = resource.name as Array<{ given?: string[]; family?: string }> | undefined
  if (!names?.[0]) return null
  const n = names[0]
  return [...(n.given ?? []), n.family ?? ""].filter(Boolean).join(" ")
}

export function EmbedLoop() {
  const searchParams = useSearchParams()
  const context = useMemo(
    () => parseCdsEmbedContext(Object.fromEntries(searchParams.entries())),
    [searchParams],
  )

  const [patients, setPatients] = useState<Patient[]>([])
  const [openIssue, setOpenIssue] = useState<Issue | null>(null)
  const [fhirName, setFhirName] = useState<string | null>(null)

  const isSandboxPatient = Boolean(sandboxIssuesForPatient(context.patientId))
  const demoPatient = useMemo(
    () => patientForEmbed(patients, context.patientId),
    [patients, context.patientId],
  )
  const issues = useMemo(
    () => issuesForEmbed(patients, context.patientId),
    [patients, context.patientId],
  )

  useEffect(() => {
    fetchClinic()
      .then((d) => setPatients(d.patients))
      .catch(() => setPatients([]))
  }, [])

  useEffect(() => {
    if (!context.patientId || demoPatient || isSandboxPatient) return
    const id = context.patientId.replace(/^Patient\//, "")
    fetch(`/fhir/Patient/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p?.resourceType === "Patient") setFhirName(fhirPatientName(p))
      })
      .catch(() => {})
  }, [context.patientId, demoPatient, isSandboxPatient])

  const patientRef = formatFhirPatientRef(context.patientId)
  const displayName =
    demoPatient?.name ?? fhirName ?? issues[0]?.patientName ?? null
  const showingDemoFallback = Boolean(
    context.patientId && !demoPatient && !isSandboxPatient && issues.length > 0,
  )

  return (
    <div className="flex h-dvh flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-2">
        <Lock className="size-3 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">Loop</p>
          {displayName ? (
            <p className="truncate text-[11px] text-muted-foreground">{displayName}</p>
          ) : patientRef ? (
            <p className="truncate text-[11px] text-muted-foreground">{patientRef}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {context.hook ?? "patient-view"}
        </span>
      </div>

      {showingDemoFallback && (
        <p className="shrink-0 border-b border-border bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
          Sample open loops — connect FHIR backend for live detection.
        </p>
      )}

      <div className="min-h-0 flex-1">
        <LoopPanel
          issues={issues}
          onOpen={setOpenIssue}
          compact
          subtitle={
            displayName
              ? `Open loops for ${displayName}`
              : "Ranked open loops from your chart session"
          }
          className="h-full w-full border-l-0"
        />
      </div>

      <WorkflowOverlay
        issue={openIssue}
        onClose={() => setOpenIssue(null)}
        compact
      />
    </div>
  )
}
