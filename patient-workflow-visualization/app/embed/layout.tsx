import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Loop — embedded assistant",
}

/** Minimal chrome for CDS Sandbox side-panel iframe. */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh overflow-hidden bg-background">{children}</div>
  )
}
