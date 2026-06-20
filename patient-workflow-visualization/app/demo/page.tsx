import { Suspense } from "react"
import { EhrDemo } from "@/components/ehr-demo"

export default function DemoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">
          Loading EHR demo…
        </div>
      }
    >
      <EhrDemo />
    </Suspense>
  )
}
