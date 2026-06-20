"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import type { Issue } from "@/lib/types"
import { sortIssues } from "@/lib/data"
import { fetchLoops } from "@/lib/api"
import { embedQuery } from "@/lib/embed-url"
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
  const [fhirName, setFhirName] = useState<string | null>(null)

  const loopId = searchParams.get("loop")
  const activeIssue = useMemo(
    () => (loopId ? issues.find((i) => i.id === loopId) ?? null : null),
    [issues, loopId],
  )

  // When embedded in the sandbox shell, tell the parent to expand the panel to a
  // full-window pop-up while a workflow is open (the side panel is too narrow for it).
  useEffect(() => {
    if (context.source !== "sandbox-shell") return
    if (typeof window === "undefined" || window.parent === window) return
    window.parent.postMessage({ type: "loop-workflow", open: Boolean(activeIssue) }, "*")
  }, [activeIssue, context.source])

  const issueHref = useCallback(
    (issue: Issue) => {
      const q = embedQuery({
        patientId: context.patientId ?? issue.patientId,
        source: context.source ?? undefined,
        hook: context.hook ?? undefined,
        loop: issue.id,
      })
      return `?${q}`
    },
    [context.patientId, context.source, context.hook],
  )

  const closeWorkflowHref = useMemo(() => {
    const q = embedQuery({
      patientId: context.patientId ?? "",
      source: context.source ?? undefined,
      hook: context.hook ?? undefined,
      loop: null,
    })
    return `?${q}`
  }, [context.patientId, context.source, context.hook])

  useEffect(() => {
    setIssues(seedIssues)
    setLoading(!demoEmbed && seedIssues.length === 0 && Boolean(context.patientId))
    setLoadError(null)
  }, [seedIssues, demoEmbed, context.patientId])

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

  const displayName = issues[0]?.patientName ?? fhirName ?? null

  return (
    <div className="flex h-dvh flex-col bg-card">
      <LoopPanel
        issues={issues}
        onOpen={() => {}}
        issueHref={issueHref}
        compact
        loading={loading}
        patientName={displayName}
        subtitle={loadError ?? "Open loops ranked for clinician review"}
        className="h-full w-full"
      />

      <WorkflowOverlay
        issue={activeIssue}
        closeHref={closeWorkflowHref}
        compact
      />
    </div>
  )
}
