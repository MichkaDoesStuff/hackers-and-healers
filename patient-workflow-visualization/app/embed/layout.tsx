import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "LoHop — embedded assistant",
}

/** Minimal chrome for CDS Sandbox side-panel iframe. */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-dvh overflow-hidden bg-card">{children}</div>
}
