"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { LohopMark } from "./lohop-mark"

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
  const closedAt = useRef(0)

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

  const togglePanel = useCallback(() => {
    setPanelOpen((open) => {
      if (open) closedAt.current = Date.now()
      return !open
    })
  }, [])

  const onLoopOpen = useCallback((nextPatientId: string) => {
    setLoopSrc(
      `/embed?patientId=${encodeURIComponent(nextPatientId)}&hook=patient-view&source=sandbox-shell`,
    )
    if (Date.now() - closedAt.current > 300) {
      setPanelOpen(true)
    }
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
    <div className="flex h-dvh flex-col bg-[#f5f5f5]">
      <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-border bg-white px-4 py-2">
        <LohopMark size="sm" />
        <div className="hidden min-w-0 flex-1 sm:block">
          <p className="text-xs text-muted-foreground">
            CDS Hooks Sandbox · side panel stays in sync when you click a card
          </p>
        </div>
        {bridgeFlash && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            Updated
          </span>
        )}
        <button
          type="button"
          onClick={togglePanel}
          className="ml-auto rounded-md border border-border bg-white px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent"
        >
          {panelOpen ? "Hide panel" : "Show panel"}
        </button>
      </header>

      <div
        className={cn(
          "grid min-h-0 flex-1 transition-[grid-template-columns] duration-200 ease-out",
          panelOpen
            ? "grid-cols-[minmax(0,1fr)_min(380px,36vw)]"
            : "grid-cols-[minmax(0,1fr)]",
        )}
      >
        <div className="min-h-0 min-w-0 bg-white">
          <iframe
            title="CDS Hooks Sandbox"
            src={sandboxSrc}
            className="h-full w-full border-0"
            allow="clipboard-read; clipboard-write"
          />
        </div>

        {panelOpen && (
          <aside className="min-h-0 min-w-0 border-l border-border bg-card shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.08)]">
            <iframe
              title="LoHop assistant"
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
