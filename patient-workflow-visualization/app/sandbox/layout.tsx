import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "LoHop + CDS Sandbox",
}

export default function SandboxLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-dvh overflow-hidden bg-background">{children}</div>
}
