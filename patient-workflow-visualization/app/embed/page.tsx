import { Suspense } from "react"
import { EmbedLoop } from "@/components/embed-loop"

function EmbedFallback() {
  return (
    <div className="flex h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
      Loading LoHop…
    </div>
  )
}

export default function EmbedPage() {
  return (
    <Suspense fallback={<EmbedFallback />}>
      <EmbedLoop />
    </Suspense>
  )
}
