"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import type { Issue, Patient } from "@/lib/types"
import { issuesForEmbed, patientForEmbed } from "@/lib/data"
import { fetchClinic } from "@/lib/api"
import { sandboxIssuesForPatient } from "@/lib/sandbox-data"
import { parseCdsEmbedContext } from "@/lib/cds-context"
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
  const [loading, setLoading] = useState(true)
  const [openIssue, setOpenIssue] = useState<Issue | null>(null)
  const [fhirName, setFhirName] = useState<string | null>(null)

  const sandboxIssues = useMemo(
    () => sandboxIssuesForPatient(context.patientId),
    [context.patientId],
  )
  const isSandboxPatient = Boolean(sandboxIssues?.length)

  const demoPatient = useMemo(
    () => patientForEmbed(patients, context.patientId),
    [patients, context.patientId],
  )
  const issues = useMemo(() => {
    if (sandboxIssues?.length) return sandboxIssues
    return issuesForEmbed(patients, context.patientId)
  }, [sandboxIssues, patients, context.patientId])

  useEffect(() => {
    if (isSandboxPatient) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetchClinic()
      .then((d) => setPatients(d.patients))
      .catch(() => setPatients([]))
      .finally(() => setLoading(false))
  }, [isSandboxPatient])

  useEffect(() => {
    if (!context.patientId || isSandboxPatient) return
    const id = context.patientId.replace(/^Patient\//, "")
    fetch(`/fhir/Patient/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p?.resourceType === "Patient") setFhirName(fhirPatientName(p))
      })
      .catch(() => {})
  }, [context.patientId, isSandboxPatient])

  const displayName =
    sandboxIssues?.[0]?.patientName ??
    demoPatient?.name ??
    fhirName ??
    issues[0]?.patientName ??
    null

  return (
    <div className="flex h-dvh flex-col bg-card">
      <LoopPanel
        issues={issues}
        onOpen={setOpenIssue}
        compact
        loading={loading && !isSandboxPatient}
        patientName={displayName}
        subtitle="Open loops ranked for clinician review"
        className="h-full w-full"
      />

      <WorkflowOverlay
        issue={openIssue}
        onClose={() => setOpenIssue(null)}
        compact
      />
    </div>
  )
}
