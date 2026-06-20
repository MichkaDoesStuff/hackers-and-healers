"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  Bell,
  Check,
  ChevronRight,
  FileText,
  GitBranch,
  Layers,
  ListChecks,
  Loader2,
  Zap,
} from "lucide-react"
import type { Issue, StepKind } from "@/lib/types"
import { CATEGORY_TO_LOOP_TYPE } from "@/lib/map-loops"
import { approveLoop, draftLoop, fetchPlaybooks, type Playbook, type PlaybookStep } from "@/lib/api"
import { buildWorkflow } from "@/lib/workflows"
import { cn } from "@/lib/utils"

type Phase = "blocks" | "drafting" | "review" | "approving" | "done" | "demo"

const STEP_META: Record<
  StepKind,
  { label: string; icon: typeof Zap; block: string; stud: string }
> = {
  trigger: {
    label: "Start",
    icon: Zap,
    block: "bg-slate-100 border-slate-200",
    stud: "bg-slate-300",
  },
  detect: {
    label: "Spot",
    icon: Activity,
    block: "bg-amber-50 border-amber-200",
    stud: "bg-amber-300",
  },
  draft: {
    label: "Draft",
    icon: FileText,
    block: "bg-sky-50 border-sky-200",
    stud: "bg-sky-300",
  },
  order: {
    label: "Order",
    icon: ListChecks,
    block: "bg-violet-50 border-violet-200",
    stud: "bg-violet-300",
  },
  notify: {
    label: "Notify",
    icon: Bell,
    block: "bg-orange-50 border-orange-200",
    stud: "bg-orange-300",
  },
  decision: {
    label: "You",
    icon: GitBranch,
    block: "bg-emerald-50 border-emerald-200",
    stud: "bg-emerald-300",
  },
  resolve: {
    label: "Done",
    icon: Check,
    block: "bg-green-50 border-green-200",
    stud: "bg-green-400",
  },
}

function stepsFromPlaybook(playbook: Playbook): PlaybookStep[] {
  return playbook.steps
}

function stepsFromIssue(issue: Issue): PlaybookStep[] {
  const wf = buildWorkflow(issue)
  return wf.nodes.map((n, i) => ({
    id: n.id ?? `s${i}`,
    kind: n.data.kind,
    title: n.data.title,
    detail: n.data.detail,
    actor: n.data.actor,
    prompt: n.data.prompt,
  }))
}

function demoDraft(issue: Issue): string {
  return `Hi — regarding ${issue.title.toLowerCase()} for ${issue.patientName}: ${issue.detail} Please review and let us know the next step.`
}

export function WorkflowRunner({
  issue,
  compact = false,
  onPhaseChange,
}: {
  issue: Issue
  compact?: boolean
  onPhaseChange?: (phase: Phase) => void
}) {
  const loopType = issue.loopType ?? CATEGORY_TO_LOOP_TYPE[issue.category]
  const hasLiveLoop = Boolean(issue.loopId)

  const [playbook, setPlaybook] = useState<Playbook | null>(null)
  const [steps, setSteps] = useState<PlaybookStep[]>([])
  const [activeStep, setActiveStep] = useState(0)
  const [phase, setPhase] = useState<Phase>("blocks")
  const [draft, setDraft] = useState("")
  const [model, setModel] = useState<string | null>(null)
  const [reviewed, setReviewed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [written, setWritten] = useState<Array<{ resourceType: string; id: string }>>([])

  const setPhaseSafe = useCallback(
    (p: Phase) => {
      setPhase(p)
      onPhaseChange?.(p)
    },
    [onPhaseChange],
  )

  useEffect(() => {
    setPhaseSafe("blocks")
    setActiveStep(0)
    setDraft("")
    setModel(null)
    setReviewed(false)
    setError(null)
    setWritten([])

    const fallback = stepsFromIssue(issue)
    setSteps(fallback)

    fetchPlaybooks(loopType)
      .then((list) => {
        const pick = list.find((p) => p.builtin) ?? list[0]
        if (pick?.steps?.length) {
          setPlaybook(pick)
          setSteps(stepsFromPlaybook(pick))
        }
      })
      .catch(() => {})
  }, [issue, loopType, setPhaseSafe])

  const draftStepIndex = useMemo(
    () => steps.findIndex((s) => s.kind === "draft"),
    [steps],
  )

  const runWorkflow = useCallback(async () => {
    setError(null)
    if (!hasLiveLoop) {
      setDraft(demoDraft(issue))
      setModel("demo")
      setPhaseSafe("review")
      if (draftStepIndex >= 0) setActiveStep(draftStepIndex)
      return
    }

    setPhaseSafe("drafting")
    if (draftStepIndex >= 0) setActiveStep(draftStepIndex)
    try {
      const res = await draftLoop(issue.loopId!, playbook?.id)
      setDraft(res.draft)
      setModel(res.model)
      setPhaseSafe("review")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft failed")
      setPhaseSafe("blocks")
    }
  }, [hasLiveLoop, issue, playbook?.id, draftStepIndex, setPhaseSafe])

  const onApprove = useCallback(async () => {
    if (!reviewed) return
    if (!hasLiveLoop) {
      setPhaseSafe("demo")
      return
    }

    setPhaseSafe("approving")
    setError(null)
    try {
      const res = await approveLoop(issue.loopId!, {
        message: draft,
        playbook_id: playbook?.id,
        approver: "Clinician",
      })
      setWritten(res.written ?? [])
      setPhaseSafe("done")
      const resolveIdx = steps.findIndex((s) => s.kind === "resolve")
      if (resolveIdx >= 0) setActiveStep(resolveIdx)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed")
      setPhaseSafe("review")
    }
  }, [reviewed, hasLiveLoop, issue.loopId, draft, playbook?.id, steps, setPhaseSafe])

  return (
    <div className="flex h-full flex-col bg-white">
      <div className={cn("shrink-0 border-b border-slate-100 bg-slate-50/80", compact ? "px-3 py-2" : "px-5 py-3")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
            <Layers className="size-3.5 text-sky-500" />
            Reusable blocks
          </span>
          {playbook && (
            <span className="text-xs text-slate-500">
              {playbook.title}
              {playbook.builtin ? " · built-in" : ` · v${playbook.version}`}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Snap blocks left-to-right — same playbook works on any matching loop.
        </p>
      </div>

      <div className="shrink-0 overflow-x-auto border-b border-slate-100 bg-white px-3 py-4 sm:px-5">
        <div className="flex min-w-min items-end gap-1">
          {steps.map((step, i) => {
            const kind = step.kind as StepKind
            const meta = STEP_META[kind] ?? STEP_META.trigger
            const Icon = meta.icon
            const active = i === activeStep
            const done =
              (phase === "review" || phase === "approving" || phase === "done" || phase === "demo") &&
              i < activeStep
            return (
              <div key={step.id} className="flex items-end">
                <button
                  type="button"
                  onClick={() => setActiveStep(i)}
                  className={cn(
                    "group relative flex w-[7.5rem] shrink-0 flex-col rounded-t-xl border-2 border-b-0 px-2 pb-2 pt-2 text-left transition-all sm:w-[8.5rem]",
                    meta.block,
                    active ? "z-10 -translate-y-1 scale-[1.02] shadow-md ring-2 ring-sky-300" : "opacity-90 hover:-translate-y-0.5 hover:opacity-100",
                    done && "opacity-70",
                  )}
                >
                  <div className={cn("mx-auto mb-1.5 h-1.5 w-6 rounded-full", meta.stud)} />
                  <div className="flex items-center gap-1">
                    <Icon className="size-3 shrink-0 text-slate-600" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold leading-tight text-slate-800">
                    {step.title}
                  </p>
                </button>
                {i < steps.length - 1 && (
                  <ChevronRight className="mx-0.5 mb-3 size-4 shrink-0 text-slate-300" aria-hidden />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-white px-3 py-4 sm:px-5">
        {steps[activeStep] && (
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Block {activeStep + 1} of {steps.length}
              {steps[activeStep].actor ? ` · ${steps[activeStep].actor}` : ""}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{steps[activeStep].title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{steps[activeStep].detail}</p>
            {steps[activeStep].kind === "draft" && steps[activeStep].prompt && phase === "blocks" && (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-100">
                AI uses a saved prompt from this playbook — you can edit the draft before approving.
              </p>
            )}
          </div>
        )}

        {phase === "drafting" && (
          <div className="mt-6 flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="size-4 animate-spin text-sky-500" />
            Writing draft from blocks…
          </div>
        )}

        {(phase === "review" || phase === "approving") && (
          <div className="mt-5 max-w-2xl">
            <label className="text-xs font-medium text-slate-500">
              Your message {model ? `(via ${model})` : ""}
            </label>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={phase === "approving"}
              className="mt-1.5 min-h-[120px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
            <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-3">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
                disabled={phase === "approving"}
                className="mt-0.5 size-4 rounded border-slate-300 text-emerald-600"
              />
              <span className="text-sm text-slate-700">
                <span className="font-medium">I reviewed this draft</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  LoHop only writes to the chart after you approve.
                </span>
              </span>
            </label>
          </div>
        )}

        {phase === "done" && (
          <div className="mt-5 max-w-2xl rounded-xl border border-green-200 bg-green-50 px-4 py-4">
            <p className="font-medium text-green-800">Loop closed — written to chart</p>
            {written.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-green-700">
                {written.map((w) => (
                  <li key={`${w.resourceType}-${w.id}`}>
                    {w.resourceType}/{w.id}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {phase === "demo" && (
          <div className="mt-5 max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            <p className="font-medium">Demo preview only</p>
            <p className="mt-1 text-amber-800/90">
              This sample loop isn&apos;t connected to live detection. Connect the backend to run
              draft → approve → FHIR write-back.
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      <div
        className={cn(
          "flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-white",
          compact ? "px-3 py-2.5" : "px-5 py-3",
        )}
      >
        {phase === "blocks" && (
          <button
            type="button"
            onClick={runWorkflow}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-sky-700"
          >
            Run blocks
          </button>
        )}
        {phase === "review" && (
          <button
            type="button"
            onClick={onApprove}
            disabled={!reviewed || !draft.trim()}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Approve &amp; close loop
          </button>
        )}
        {phase === "approving" && (
          <span className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Writing to chart…
          </span>
        )}
      </div>
    </div>
  )
}
