"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronRight } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { severityDot, severitySurface, severityText } from "@/lib/severity"
import { cn } from "@/lib/utils"
import { LohopMark } from "./lohop-mark"

interface CdsCard {
  summary: string
  detail?: string
  indicator?: string
  source?: { label?: string }
  links?: Array<{ label: string; url: string; type?: string }>
}

const DEFAULT_PATIENT = "b61008f3-84e2-8e3f-abd9-995a23133d57"

function patientNameFromFhir(resource: Record<string, unknown>): string {
  const names = resource.name as Array<{ given?: string[]; family?: string }> | undefined
  if (!names?.[0]) return "Unknown patient"
  const n = names[0]
  return [...(n.given ?? []), n.family ?? ""].filter(Boolean).join(" ")
}

export function EhrDemo() {
  const searchParams = useSearchParams()
  const patientId = searchParams.get("patientId") ?? DEFAULT_PATIENT

  const [patientName, setPatientName] = useState<string>("Loading…")
  const [birthDate, setBirthDate] = useState<string>("")
  const [cards, setCards] = useState<CdsCard[]>([])
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)

  const embedSrc = useMemo(() => {
    if (embedUrl) return embedUrl
    const q = new URLSearchParams({
      patientId,
      hook: "patient-view",
      source: "ehr-demo",
    })
    return `/embed?${q.toString()}`
  }, [embedUrl, patientId])

  const loadSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const patientRes = await fetch(`/fhir/Patient/${patientId}`)
      if (patientRes.ok) {
        const patient = await patientRes.json()
        setPatientName(patientNameFromFhir(patient))
        setBirthDate(String(patient.birthDate ?? ""))
      } else {
        setPatientName(`Patient ${patientId.slice(0, 8)}…`)
      }

      const hookRes = await fetch("/cds-services/triage-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook: "patient-view",
          hookInstance: `demo-${Date.now()}`,
          fhirServer: typeof window !== "undefined" ? `${window.location.origin}/fhir` : "",
          context: { patientId, userId: "Practitioner/demo" },
          prefetch: {},
        }),
      })

      if (!hookRes.ok) throw new Error(`CDS hook failed (${hookRes.status})`)

      const data = await hookRes.json()
      const nextCards: CdsCard[] = data.cards ?? []
      setCards(nextCards)

      const link = nextCards[0]?.links?.[0]?.url
      if (link) {
        setEmbedUrl(link)
        setPanelOpen(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load demo")
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  function openLoop(link?: string) {
    if (link) setEmbedUrl(link)
    setPanelOpen(true)
  }

  function togglePanel() {
    setPanelOpen((open) => !open)
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-border bg-white px-4 py-2">
        <LohopMark size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Patient chart demo · CDS Hooks patient-view</p>
        </div>
        <button
          type="button"
          onClick={togglePanel}
          className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent"
        >
          {panelOpen ? "Hide panel" : "Show panel"}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-y-auto",
            panelOpen && "border-r border-border",
          )}
        >
          <div className="border-b border-border px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Patient View</p>
            <h1 className="mt-1 text-xl font-semibold text-foreground">{patientName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              ID: {patientId}
              {birthDate ? ` · Birthdate: ${birthDate}` : ""}
            </p>
          </div>

          <div className="px-5 py-4">
            <h2 className="text-sm font-medium text-foreground">Clinical decision support</h2>
            {loading && (
              <p className="mt-3 text-sm text-muted-foreground">Calling CDS hook…</p>
            )}
            {error && (
              <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            {!loading && !error && cards.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">No CDS cards returned.</p>
            )}
            <div className="mt-3 flex flex-col gap-2.5">
              {cards.map((card, idx) => {
                const indicator = card.indicator ?? "info"
                const surface =
                  indicator === "critical" || indicator === "error"
                    ? severitySurface.critical
                    : indicator === "warning"
                      ? severitySurface.warning
                      : severitySurface.routine
                const text =
                  indicator === "critical" || indicator === "error"
                    ? severityText.critical
                    : indicator === "warning"
                      ? severityText.warning
                      : severityText.routine
                const dot =
                  indicator === "critical" || indicator === "error"
                    ? severityDot.critical
                    : indicator === "warning"
                      ? severityDot.warning
                      : severityDot.routine
                const link = card.links?.[0]

                return (
                  <button
                    key={`${card.summary}-${idx}`}
                    onClick={() => openLoop(link?.url)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:opacity-95",
                      surface,
                    )}
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", dot)} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("font-semibold", text)}>{card.summary}</p>
                      {card.detail && (
                        <p className="mt-1 text-sm text-muted-foreground">{card.detail}</p>
                      )}
                      {card.source?.label && (
                        <p className="mt-1 text-xs text-muted-foreground">Source: {card.source.label}</p>
                      )}
                      {link && (
                        <p className={cn("mt-2 inline-flex items-center gap-1 text-sm font-medium", text)}>
                          {link.label}
                          <ChevronRight className="size-4" />
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </main>

        {panelOpen ? (
          <div
            className="h-full shrink-0 border-l border-border bg-card shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.08)]"
            style={{ width: "min(42%, 480px)" }}
          >
            <iframe
              title="LoHop assistant"
              src={embedSrc}
              className="h-full w-full border-0"
              allow="clipboard-read; clipboard-write"
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
