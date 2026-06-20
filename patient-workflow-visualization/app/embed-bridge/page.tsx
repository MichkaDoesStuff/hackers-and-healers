import { Suspense } from "react"
import { EmbedBridge } from "@/components/embed-bridge"

export default function EmbedBridgePage() {
  return (
    <Suspense fallback={null}>
      <EmbedBridge />
    </Suspense>
  )
}
