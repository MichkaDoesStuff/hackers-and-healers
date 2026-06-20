import { Suspense } from "react"
import { SandboxShell } from "@/components/sandbox-shell"
import { resolvePublicOrigin } from "@/lib/public-origin"

export default async function SandboxPage() {
  const publicOrigin = await resolvePublicOrigin()

  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">
          Loading sandbox shell…
        </div>
      }
    >
      <SandboxShell publicOrigin={publicOrigin} />
    </Suspense>
  )
}
