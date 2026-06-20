"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import type { Issue, Severity } from "@/lib/types"
import { patientsRanked, topSeverity } from "@/lib/data"
import { cn } from "@/lib/utils"
import { PatientCard } from "./patient-card"

type Filter = "all" | "issues" | "clear"

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "issues", label: "Open loops" },
  { id: "clear", label: "All clear" },
]

export function PatientsView({ onOpen }: { onOpen: (issue: Issue) => void }) {
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")

  const ranked = useMemo(() => patientsRanked(), [])
  const counts = useMemo(() => {
    let critical = 0
    let warning = 0
    let clear = 0
    for (const p of ranked) {
      const s = topSeverity(p)
      if (s === null) clear++
      else if (s === "critical") critical++
      else warning++
    }
    return { critical, warning, clear }
  }, [ranked])

  const filtered = ranked.filter((p) => {
    const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase())
    if (!matchesQuery) return false
    if (filter === "issues") return p.issues.length > 0
    if (filter === "clear") return p.issues.length === 0
    return true
  })

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-col gap-4 px-5 pb-4 pt-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Patients</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ranked by open loops — anything that fell through the cracks rises to the top.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Stat dot="critical" label="critical" value={counts.critical} />
          <Stat dot="warning" label="need attention" value={counts.warning} />
          <Stat dot="healthy" label="all clear" value={counts.clear} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 rounded-lg bg-muted/50 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  filter === f.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patients"
              className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto px-5 pb-6">
        {filtered.map((p) => (
          <PatientCard key={p.id} patient={p} onOpen={onOpen} />
        ))}
        {filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">No patients match.</p>
        )}
      </div>
    </div>
  )
}

function Stat({
  dot,
  label,
  value,
}: {
  dot: "critical" | "warning" | "healthy"
  label: string
  value: number
}) {
  const dotClass =
    dot === "critical" ? "bg-critical" : dot === "warning" ? "bg-warning" : "bg-healthy"
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5">
      <span className={cn("size-2 rounded-full", dotClass)} />
      <span className="text-sm font-semibold text-foreground">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}
