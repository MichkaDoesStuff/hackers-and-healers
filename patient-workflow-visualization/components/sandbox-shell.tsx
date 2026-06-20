"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Lock, Stethoscope } from "lucide-react"
import { useSearchParams } from "next/navigation"

const DEFAULT_PATIENT = "b61008f3-84e2-8e3f-abd9-995a23133d57"
const DEFAULT_FHIR = "https://lohp.ryanbeland.dev/fhir"

type SandboxShellProps = {
  /** Resolved on the server so the sandbox iframe works without client hydration. */
  publicOrigin: string
}

export function SandboxShell({ publicOrigin }: SandboxShellProps) {
  const searchParams = useSearchParams()
  const patientId = searchParams.get("patientId") ?? DEFAULT_PATIENT
  const fhirUrl = searchParams.get("fhirServiceUrl") ?? DEFAULT_FHIR

  const [loopSrc, setLoopSrc] = useState(`/embed?patientId=${encodeURIComponent(patientId)}&source=sandbox-shell`)
  const [panelOpen, setPanelOpen] = useState(true)
  const [bridgeFlash, setBridgeFlash] = useState(false)

  const discoveryUrl = `${publicOrigin}/cds-services`

  const sandboxSrc = useMemo(() => {
    if (!discoveryUrl) return ""
    const q = new URLSearchParams({
      fhirServiceUrl: fhirUrl,
      serviceDiscoveryURL: discoveryUrl,
      patientId,
      screen: "patient-view",
    })
    return `https://sandbox.cds-hooks.org/?${q.toString()}`
  }, [discoveryUrl, fhirUrl, patientId])

  const onLoopOpen = useCallback((nextPatientId: string) => {
    setLoopSrc(
      `/embed?patientId=${encodeURIComponent(nextPatientId)}&hook=patient-view&source=sandbox-shell`,
    )
    setPanelOpen(true)
    setBridgeFlash(true)
    window.setTimeout(() => setBridgeFlash(false), 1200)
  }, [])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type !== "loop-open") return
      const id = event.data.patientId
      if (typeof id === "string" && id.length > 0) onLoopOpen(id)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [onLoopOpen])

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <Stethoscope className="size-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Loop + CDS Hooks Sandbox</p>
          <p className="text-xs text-muted-foreground">
            Real sandbox UI · Loop side panel stays embedded when you click a card link
          </p>
        </div>
        {bridgeFlash && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
            Loop updated
          </span>
        )}
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
        >
          {panelOpen ? "Hide Loop" : "Show Loop"}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div
          className={
            panelOpen
              ? "flex min-w-0 flex-1 flex-col border-r border-border"
              : "flex min-w-0 flex-1 flex-col"
          }
        >
          {sandboxSrc ? (
            <iframe
              title="CDS Hooks Sandbox"
              src={sandboxSrc}
              className="h-full w-full border-0"
              allow="clipboard-read; clipboard-write"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading sandbox…
            </div>
          )}
        </div>

        {panelOpen && (
          <aside className="flex w-[min(420px,38vw)] min-w-[300px] flex-col border-l border-border bg-background">
            <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-2">
              <Lock className="size-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Loop · embedded side panel</p>
            </div>
            <iframe
              title="Loop assistant"
              src={loopSrc}
              className="h-full w-full border-0"
              allow="clipboard-read; clipboard-write"
            />
          </aside>
        )}
      </div>
    </div>
  )
}
