"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import {
  Activity,
  Bell,
  CalendarCheck,
  CalendarPlus,
  Check,
  FileText,
  GitBranch,
  ListChecks,
  Phone,
  Zap,
} from "lucide-react"
import type { StepKind, WorkflowStepData } from "@/lib/types"
import { cn } from "@/lib/utils"

const META: Record<
  StepKind,
  { label: string; icon: typeof Zap; accent: string; ring: string }
> = {
  trigger: { label: "Trigger", icon: Zap, accent: "text-muted-foreground", ring: "border-border" },
  detect: { label: "Detection", icon: Activity, accent: "text-critical-foreground", ring: "border-critical-surface/60" },
  draft: { label: "AI draft", icon: FileText, accent: "text-foreground", ring: "border-border" },
  order: { label: "Order", icon: ListChecks, accent: "text-warning-foreground", ring: "border-warning-surface/60" },
  notify: { label: "Notify", icon: Bell, accent: "text-warning-foreground", ring: "border-warning-surface/60" },
  call: { label: "Phone call", icon: Phone, accent: "text-warning-foreground", ring: "border-warning-surface/60" },
  book: { label: "Book slot", icon: CalendarPlus, accent: "text-foreground", ring: "border-border" },
  calendar: { label: "Calendar", icon: CalendarCheck, accent: "text-healthy-foreground", ring: "border-healthy-surface/60" },
  decision: { label: "Decision", icon: GitBranch, accent: "text-foreground", ring: "border-border" },
  resolve: { label: "Resolve", icon: Check, accent: "text-healthy-foreground", ring: "border-healthy-surface/60" },
}

function StepNodeImpl({ data, selected }: NodeProps) {
  const d = data as WorkflowStepData
  const meta = META[d.kind]
  const Icon = meta.icon

  return (
    <div
      className={cn(
        "w-60 cursor-pointer rounded-xl border bg-card px-3.5 py-3 shadow-lg transition-colors hover:border-ring/60",
        meta.ring,
        selected && "ring-2 ring-ring",
      )}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span className={cn("flex size-6 items-center justify-center rounded-md bg-muted", meta.accent)}>
          <Icon className="size-3.5" />
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {meta.label}
        </span>
        {d.actor && (
          <span className="ml-auto rounded bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {d.actor}
          </span>
        )}
      </div>
      <div className="mt-2 text-[15px] font-semibold leading-tight text-foreground">{d.title}</div>
      <div className="mt-1 text-xs leading-snug text-muted-foreground">{d.detail}</div>
      {d.prompt && (
        <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-ring">
          <FileText className="size-3" /> AI prompt · click to edit
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export const StepNode = memo(StepNodeImpl)
