import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Loop — CDS Sandbox demo",
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-dvh overflow-hidden bg-background">{children}</div>
}
