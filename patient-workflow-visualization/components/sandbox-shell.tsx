"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import {
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  ShieldCheck,
  Stethoscope,
} from "lucide-react"
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
  const [workflowOpen, setWorkflowOpen] = useState(false)

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
      if (event.data?.type === "loop-workflow") {
        setWorkflowOpen(Boolean(event.data.open))
        return
      }
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
    <div className="flex h-dvh flex-col bg-background">
      <header className="relative z-20 flex shrink-0 items-center gap-4 border-b border-border bg-card px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <LohopMark size="sm" />
          <span className="hidden h-5 w-px shrink-0 bg-border sm:block" />
          <p className="hidden min-w-0 truncate text-xs text-muted-foreground md:block">
            An AI safety net inside the EHR — it catches clinical tasks that
            slipped through the cracks and drafts the fix for you to approve.
          </p>
        </div>

        {/* How it works — compact step hint */}
        <div className="ml-auto hidden items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] text-muted-foreground lg:flex">
          <span className="font-medium text-foreground">How it works</span>
          <ChevronRight className="size-3 shrink-0 opacity-50" aria-hidden />
          <span>chart opens</span>
          <ChevronRight className="size-3 shrink-0 opacity-50" aria-hidden />
          <span>LoHop flags dropped tasks</span>
          <ChevronRight className="size-3 shrink-0 opacity-50" aria-hidden />
          <span>review &amp; approve</span>
        </div>

        <Link
          href={panelOpen ? hidePanelHref : showPanelHref}
          className="relative z-20 ml-auto flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent lg:ml-0"
        >
          {panelOpen ? (
            <PanelRightClose className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <PanelRightOpen className="size-3.5 shrink-0" aria-hidden />
          )}
          {panelOpen ? "Hide panel" : "Show panel"}
        </Link>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div className="relative flex h-full min-w-0 flex-1 flex-col bg-card">
          <div className="flex shrink-0 items-center gap-2 border-b border-border/70 bg-background/60 px-4 py-1.5">
            <Stethoscope className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate text-[11px] font-medium tracking-wide text-muted-foreground">
              Clinician&apos;s chart
              <span className="font-normal text-muted-foreground/70">
                {" "}
                · CDS Hooks Sandbox (demo EHR)
              </span>
            </span>
          </div>
          <iframe
            title="CDS Hooks Sandbox"
            src={sandboxSrc}
            className="h-full w-full flex-1 border-0"
            allow="clipboard-read; clipboard-write"
          />
        </div>

        {panelOpen ? (
          <div
            key={embedPatientId}
            className={
              workflowOpen
                ? "absolute inset-0 z-30 flex h-full w-full flex-col bg-card"
                : "flex h-full shrink-0 flex-col border-l border-border bg-card shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.08)]"
            }
            style={workflowOpen ? undefined : { width: PANEL_WIDTH }}
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-border/70 bg-primary/5 px-4 py-1.5">
              <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-hidden />
              <span className="truncate text-[11px] font-medium tracking-wide text-foreground">
                LoHop
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · open-loop assistant
                </span>
              </span>
            </div>
            <iframe
              title="LoHop assistant"
              src={loopSrc}
              className="h-full w-full flex-1 border-0"
              allow="clipboard-read; clipboard-write"
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
