"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import type { Issue } from "@/lib/types"
import { sortIssues } from "@/lib/data"
import { fetchLoops } from "@/lib/api"
import { mapLoopToIssue } from "@/lib/map-loops"
import { demoIssuesForEmbed, sandboxIssuesForPatient } from "@/lib/sandbox-data"
import { parseCdsEmbedContext } from "@/lib/cds-context"
import { LoopPanel } from "./loop-panel"
import { WorkflowOverlay } from "./workflow/workflow-overlay"

function fhirPatientName(resource: Record<string, unknown>): string | null {
  const names = resource.name as Array<{ given?: string[]; family?: string }> | undefined
  if (!names?.[0]) return null
  const n = names[0]
  return [...(n.given ?? []), n.family ?? ""].filter(Boolean).join(" ")
}

function isDemoEmbedSource(source: string | null): boolean {
  return source === "sandbox-shell" || source === "ehr-demo"
}

/** Issues available immediately — never wait on FHIR for sandbox embed. */
function instantIssues(patientId: string | null, source: string | null): Issue[] {
  if (!patientId) {
    return isDemoEmbedSource(source) ? sortIssues(demoIssuesForEmbed()) : []
  }
  const mapped = sandboxIssuesForPatient(patientId)
  if (mapped?.length) return sortIssues(mapped)
  if (isDemoEmbedSource(source)) return sortIssues(demoIssuesForEmbed(patientId))
  return []
}

export function EmbedLoop() {
  const searchParams = useSearchParams()
  const context = useMemo(
    () => parseCdsEmbedContext(Object.fromEntries(searchParams.entries())),
    [searchParams],
  )

  const seedIssues = useMemo(
    () => instantIssues(context.patientId, context.source),
    [context.patientId, context.source],
  )
  const demoEmbed = isDemoEmbedSource(context.source)

  const [issues, setIssues] = useState<Issue[]>(seedIssues)
  const [loading, setLoading] = useState(() => !demoEmbed && seedIssues.length === 0 && Boolean(context.patientId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [openIssue, setOpenIssue] = useState<Issue | null>(null)
  const [fhirName, setFhirName] = useState<string | null>(null)

  // Keep in sync when URL patient changes (e.g. CDS card click in parent)
  useEffect(() => {
    setIssues(seedIssues)
    setLoading(!demoEmbed && seedIssues.length === 0 && Boolean(context.patientId))
    setLoadError(null)
  }, [seedIssues, demoEmbed, context.patientId])

  // Live API refresh — background for demo embed, blocking only for standalone SMART launch
  useEffect(() => {
    if (!context.patientId) return

    let cancelled = false
    if (!demoEmbed && seedIssues.length === 0) setLoading(true)

    fetchLoops(context.patientId, demoEmbed ? 5_000 : 8_000)
      .then((data) => {
        if (cancelled) return
        const mapped = sortIssues(data.loops.map(mapLoopToIssue))
        if (mapped.length > 0) setIssues(mapped)
      })
      .catch((e) => {
        if (cancelled) return
        if (!demoEmbed && seedIssues.length === 0) {
          setLoadError(e instanceof Error ? e.message : "Could not load loops")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [context.patientId, demoEmbed, seedIssues.length])

  useEffect(() => {
    if (!context.patientId) return
    const id = context.patientId.replace(/^Patient\//, "")
    fetch(`/fhir/Patient/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p?.resourceType === "Patient") setFhirName(fhirPatientName(p))
      })
      .catch(() => {})
  }, [context.patientId])

  const displayName =
    issues[0]?.patientName ??
    fhirName ??
    null

  return (
    <div className="flex h-dvh flex-col bg-card">
      <LoopPanel
        issues={issues}
        onOpen={setOpenIssue}
        compact
        loading={loading}
        patientName={displayName}
        subtitle={loadError ?? "Open loops ranked for clinician review"}
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
