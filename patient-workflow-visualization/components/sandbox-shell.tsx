"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { embedPath, LOOP_OPEN_STORAGE_KEY } from "@/lib/embed-url"
import { LohopMark } from "./lohop-mark"

const DEFAULT_PATIENT = "b61008f3-84e2-8e3f-abd9-995a23133d57"
const DEFAULT_FHIR = "https://lohp.ryanbeland.dev/fhir"
const PANEL_WIDTH = "min(380px, 36vw)"

type SandboxShellProps = {
  publicOrigin: string
}

function sandboxPageQuery(
  searchParams: URLSearchParams,
  patch: Record<string, string | null>,
): string {
  const q = new URLSearchParams(searchParams.toString())
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) q.delete(key)
    else q.set(key, value)
  }
  return `?${q.toString()}`
}

export function SandboxShell({ publicOrigin }: SandboxShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const patientId = searchParams.get("patientId") ?? DEFAULT_PATIENT
  const fhirUrl = searchParams.get("fhirServiceUrl") ?? DEFAULT_FHIR
  const panelOpen = searchParams.get("panel") !== "0"
  const [embedPatientId, setEmbedPatientId] = useState(patientId)

  useEffect(() => {
    setEmbedPatientId(patientId)
  }, [patientId])

  const loopSrc = embedPath({
    patientId: embedPatientId,
    source: "sandbox-shell",
    hook: "patient-view",
  })
  const hidePanelHref = sandboxPageQuery(searchParams, { panel: "0" })
  const showPanelHref = sandboxPageQuery(searchParams, { panel: null })

  const discoveryUrl = `${publicOrigin}/cds-services`

  const sandboxSrc = useMemo(() => {
    const q = new URLSearchParams({
      fhirServiceUrl: fhirUrl,
      serviceDiscoveryURL: discoveryUrl,
      patientId,
      screen: "patient-view",
    })
    return `https://sandbox.cds-hooks.org/?${q.toString()}`
  }, [discoveryUrl, fhirUrl, patientId])

  const onLoopOpen = useCallback(
    (nextPatientId: string) => {
      setEmbedPatientId(nextPatientId)
      const q = new URLSearchParams(searchParams.toString())
      q.delete("panel")
      q.set("patientId", nextPatientId)
      router.replace(`?${q.toString()}`)
    },
    [searchParams, router],
  )

  useEffect(() => {
    function handleLoopOpen(id: string) {
      if (id.length > 0) onLoopOpen(id)
    }

    function onMessage(event: MessageEvent) {
      if (event.data?.type !== "loop-open") return
      const id = event.data.patientId
      if (typeof id === "string") handleLoopOpen(id)
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== LOOP_OPEN_STORAGE_KEY || !event.newValue) return
      try {
        const { patientId: id } = JSON.parse(event.newValue) as { patientId?: string }
        if (typeof id === "string") handleLoopOpen(id)
      } catch {
        /* ignore */
      }
    }

    window.addEventListener("message", onMessage)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener("message", onMessage)
      window.removeEventListener("storage", onStorage)
    }
  }, [onLoopOpen])

  return (
    <div className="flex h-dvh flex-col bg-[#f5f5f5]">
      <header className="relative z-20 flex shrink-0 items-center gap-3 border-b border-border bg-white px-4 py-2">
        <LohopMark size="sm" />
        <div className="hidden min-w-0 flex-1 sm:block">
          <p className="text-xs text-muted-foreground">
            CDS Hooks Sandbox · side panel stays in sync when you click a card
          </p>
        </div>
        <Link
          href={panelOpen ? hidePanelHref : showPanelHref}
          className="relative z-20 ml-auto rounded-md border border-border bg-white px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent"
        >
          {panelOpen ? "Hide panel" : "Show panel"}
        </Link>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div className="h-full min-w-0 flex-1 bg-white">
          <iframe
            title="CDS Hooks Sandbox"
            src={sandboxSrc}
            className="h-full w-full border-0"
            allow="clipboard-read; clipboard-write"
          />
        </div>

        {panelOpen ? (
          <div
            key={embedPatientId}
            className="h-full shrink-0 border-l border-border bg-card shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.08)]"
            style={{ width: PANEL_WIDTH }}
          >
            <iframe
              title="LoHop assistant"
              src={loopSrc}
              className="h-full w-full border-0"
              allow="clipboard-read; clipboard-write"
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
