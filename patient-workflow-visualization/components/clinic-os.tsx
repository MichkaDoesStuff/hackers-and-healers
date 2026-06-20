"use client"

import { useMemo, useState } from "react"
import type { Issue } from "@/lib/types"
import { allIssuesRanked } from "@/lib/data"
import { TopNav } from "./top-nav"
import { PatientsView } from "./patients-view"
import { LoopPanel } from "./loop-panel"
import { WorkflowOverlay } from "./workflow/workflow-overlay"

export function ClinicOS() {
  const issues = useMemo(() => allIssuesRanked(), [])
  const [openIssue, setOpenIssue] = useState<Issue | null>(null)
  const [loopOpenMobile, setLoopOpenMobile] = useState(false)

  return (
    <div className="flex h-dvh flex-col bg-background">
      <TopNav active="Patients" openCount={issues.length} onLoopClick={() => setLoopOpenMobile((v) => !v)} />

      <div className="flex min-h-0 flex-1">
        <PatientsView onOpen={setOpenIssue} />
        <div className={loopOpenMobile ? "block" : "hidden lg:block"}>
          <LoopPanel issues={issues} onOpen={setOpenIssue} />
        </div>
      </div>

      <WorkflowOverlay issue={openIssue} onClose={() => setOpenIssue(null)} />
    </div>
  )
}
