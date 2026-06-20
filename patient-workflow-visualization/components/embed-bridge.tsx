"use client"

import { useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"

/**
 * Opened briefly by CDS Sandbox card links (window.open).
 * Notifies the /sandbox parent via postMessage, then closes.
 */
export function EmbedBridge() {
  const searchParams = useSearchParams()
  const patientId = searchParams.get("patientId") ?? ""

  const demoFallback = useMemo(() => {
    const q = new URLSearchParams({ patientId })
    return `/demo?${q.toString()}`
  }, [patientId])

  useEffect(() => {
    if (!patientId) {
      window.location.replace("/demo")
      return
    }

    const msg = { type: "loop-open", patientId }

    if (window.opener && !window.opener.closed) {
      let target: Window | null = window.opener
      while (target) {
        target.postMessage(msg, "*")
        target = target.parent !== target ? target.parent : null
      }
      window.setTimeout(() => window.close(), 150)
      return
    }

    window.location.replace(demoFallback)
  }, [patientId, demoFallback])

  return (
    <div className="flex h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
      Opening Loop in the side panel…
    </div>
  )
}
