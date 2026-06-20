"use client"

import type { Issue } from "@/lib/types"
import { WorkflowCanvas } from "@/components/workflow/workflow-canvas"

// A blank-ish seed so the builder opens with a starter template you can reshape.
const SEED: Issue = {
  id: "builder-seed",
  patientId: "",
  patientName: "Sample patient",
  title: "New workflow",
  summary: "Design a reusable clinical workflow",
  severity: "warning",
  category: "lab",
  ageDays: 0,
  source: "builder",
  detail: "Add steps from the palette, connect them, edit a node (LLM prompt or Twilio SMS), then Save.",
}

export default function WorkflowsBuilder() {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-foreground">Workflow builder</h1>
          <p className="text-xs text-muted-foreground">
            n8n-style nodes — add from the palette, drag to connect, click a node to edit (LLM prompt / Twilio SMS), then Save.
          </p>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <WorkflowCanvas issue={SEED} />
      </div>
    </div>
  )
}
