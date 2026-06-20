"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { broadcastLoopOpen, sandboxPath } from "@/lib/embed-url"

/**
 * CDS Sandbox opens card links in a new tab. We signal the /sandbox parent via
 * localStorage (same-origin, cross-tab) then close this tab. Never leave the
 * user on a stray page or redirect to /demo.
 */
export function EmbedBridge() {
  const searchParams = useSearchParams()
  const patientId = searchParams.get("patientId") ?? ""

  useEffect(() => {
    if (!patientId) {
      window.location.replace("/sandbox")
      return
    }

    const msg = { type: "loop-open", patientId }
    broadcastLoopOpen(patientId)

    try {
      window.opener?.postMessage(msg, "*")
    } catch {
      /* cross-origin */
    }
    try {
      window.opener?.top?.postMessage(msg, "*")
    } catch {
      /* cross-origin */
    }

    const closeAndFallback = () => {
      try {
        window.close()
      } catch {
        /* popup block */
      }
      window.setTimeout(() => {
        if (!window.closed) {
          window.location.replace(sandboxPath(patientId))
        }
      }, 120)
    }

    window.setTimeout(closeAndFallback, 80)
  }, [patientId])

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
      <p>Updating LoHop panel…</p>
      <p className="text-xs">This tab will close automatically.</p>
    </div>
  )
}
