"use client"

import { useEffect, useMemo, useState } from "react"
import type { Issue, Patient } from "@/lib/types"
import { allIssuesRanked } from "@/lib/data"
import { fetchClinic, launchPatient } from "@/lib/api"
import { TopNav } from "./top-nav"
import { PatientsView } from "./patients-view"
import { LoopPanel } from "./loop-panel"
import { WorkflowOverlay } from "./workflow/workflow-overlay"

export function ClinicOS() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openIssue, setOpenIssue] = useState<Issue | null>(null)
  const [loopOpenMobile, setLoopOpenMobile] = useState(false)

  const scoped = useMemo(() => launchPatient(), [])

  useEffect(() => {
    fetchClinic()
      .then((d) => setPatients(d.patients))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }, [])

  // The Loop panel is the in-EMR surface: scope it to the launched chart if present.
  const panelPatients = scoped ? patients.filter((p) => p.id === scoped) : patients
  const issues = useMemo(() => allIssuesRanked(panelPatients), [panelPatients])

  return (
    <div className="flex h-dvh flex-col bg-background">
      <TopNav active="Patients" openCount={issues.length} onLoopClick={() => setLoopOpenMobile((v) => !v)} />

      <div className="flex min-h-0 flex-1">
        <PatientsView patients={patients} loading={loading} error={error} onOpen={setOpenIssue} />
        <div className={loopOpenMobile ? "block" : "hidden lg:block"}>
          <LoopPanel issues={issues} onOpen={setOpenIssue} scopedName={scoped ? panelPatients[0]?.name : null} />
        </div>
      </div>

      <WorkflowOverlay issue={openIssue} onClose={() => setOpenIssue(null)} />
    </div>
  )
}
