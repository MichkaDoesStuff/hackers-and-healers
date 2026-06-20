"use client"

import { useCallback, useMemo, useState, type ReactNode } from "react"
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
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
  Plus,
  Trash2,
  X,
  Zap,
} from "lucide-react"
import type { Issue, StepKind, WorkflowStepData } from "@/lib/types"
import { buildWorkflow, type StepNode as StepNodeType } from "@/lib/workflows"
import { StepNode } from "./step-node"

const PALETTE: { kind: StepKind; label: string; icon: typeof Zap }[] = [
  { kind: "detect", label: "Detection", icon: Activity },
  { kind: "draft", label: "AI draft", icon: FileText },
  { kind: "order", label: "Order", icon: ListChecks },
  { kind: "notify", label: "Notify", icon: Bell },
  { kind: "call", label: "Phone call", icon: Phone },
  { kind: "book", label: "Book slot", icon: CalendarPlus },
  { kind: "calendar", label: "Calendar", icon: CalendarCheck },
  { kind: "decision", label: "Decision", icon: GitBranch },
  { kind: "resolve", label: "Resolve", icon: Check },
]

const DEFAULT_PROMPT = "Describe what the AI should produce at this step."
const INPUT =
  "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-ring"

function Canvas({ issue }: { issue: Issue }) {
  const initial = useMemo(() => buildWorkflow(issue), [issue])
  const [nodes, setNodes, onNodesChange] = useNodesState<StepNodeType>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { screenToFlowPosition } = useReactFlow()

  const nodeTypes = useMemo(() => ({ step: StepNode }), [])
  const selected = nodes.find((n) => n.id === selectedId) || null

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, animated: false }, eds)),
    [setEdges],
  )

  const updateData = useCallback(
    (id: string, patch: Partial<WorkflowStepData>) =>
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      ),
    [setNodes],
  )

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id))
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
      setSelectedId(null)
    },
    [setNodes, setEdges],
  )

  const addStep = useCallback(
    (kind: StepKind, label: string) => {
      const id = `n-${kind}-${Date.now()}`
      const position = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      const isAi = kind === "draft" || kind === "detect"
      const actor = kind === "call" ? "Phone agent" : isAi ? "Loop AI" : "Loop"
      setNodes((nds) => [
        ...nds,
        {
          id,
          type: "step",
          position,
          data: {
            kind,
            title: `New ${label.toLowerCase()} step`,
            detail: "Click to describe this step",
            actor,
            prompt: isAi ? DEFAULT_PROMPT : undefined,
            calendarTarget: kind === "calendar" ? "Clinic calendar" : undefined,
          },
        },
      ])
      setSelectedId(id)
    },
    [screenToFlowPosition, setNodes],
  )

  const onNodeClick = useCallback((_: unknown, node: Node) => setSelectedId(node.id), [])

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={() => setSelectedId(null)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ style: { strokeWidth: 1.5 } }}
        minZoom={0.3}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="oklch(0.88 0.006 90)" />
        <Controls className="!border-border !bg-card [&_button]:!border-border [&_button]:!bg-card [&_button]:!fill-foreground [&_button:hover]:!bg-accent" />
        <MiniMap
          pannable
          zoomable
          className="!bg-card"
          maskColor="oklch(0.98 0.002 90 / 70%)"
          nodeColor="oklch(0.75 0.01 60)"
        />
      </ReactFlow>

      {/* palette */}
      <div className="absolute left-4 top-4 flex flex-col gap-1.5 rounded-xl border border-border bg-card/90 p-2 backdrop-blur">
        <span className="px-1 pb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Add step</span>
        {PALETTE.map((p) => {
          const Icon = p.icon
          return (
            <button
              key={p.kind}
              onClick={() => addStep(p.kind, p.label)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <Icon className="size-4 text-muted-foreground" />
              {p.label}
              <Plus className="ml-auto size-3.5 text-muted-foreground" />
            </button>
          )
        })}
      </div>

      {/* node editor */}
      {selected && (
        <NodeEditor
          key={selected.id}
          node={selected}
          onChange={(patch) => updateData(selected.id, patch)}
          onDelete={() => deleteNode(selected.id)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

function NodeEditor({
  node,
  onChange,
  onDelete,
  onClose,
}: {
  node: StepNodeType
  onChange: (patch: Partial<WorkflowStepData>) => void
  onDelete: () => void
  onClose: () => void
}) {
  const d = node.data
  const isAi = d.kind === "draft" || d.kind === "detect"
  const isCall = d.kind === "call"
  const isCalendar = d.kind === "calendar"
  return (
    <div className="absolute right-4 top-4 bottom-4 flex w-80 flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-card/95 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Edit step · {d.kind}
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      <Field label="Title">
        <input className={INPUT} value={d.title} onChange={(e) => onChange({ title: e.target.value })} />
      </Field>

      <Field label="Description">
        <textarea className={`${INPUT} min-h-16 resize-y`} value={d.detail} onChange={(e) => onChange({ detail: e.target.value })} />
      </Field>

      <Field label="Owner">
        <input className={INPUT} value={d.actor ?? ""} onChange={(e) => onChange({ actor: e.target.value })} />
      </Field>

      {isAi && (
        <Field label="AI prompt">
          <textarea
            className={`${INPUT} min-h-40 resize-y font-mono text-xs leading-relaxed`}
            value={d.prompt ?? ""}
            onChange={(e) => onChange({ prompt: e.target.value })}
            placeholder={DEFAULT_PROMPT}
          />
        </Field>
      )}

      {isCall && (
        <Field label="Patient phone (E.164)">
          <input
            className={INPUT}
            value={d.phone ?? ""}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="+14165551234"
          />
        </Field>
      )}

      {isCalendar && (
        <Field label="Calendar target">
          <input
            className={INPUT}
            value={d.calendarTarget ?? ""}
            onChange={(e) => onChange({ calendarTarget: e.target.value })}
            placeholder="Clinic calendar / Google / webhook"
          />
        </Field>
      )}

      <button
        onClick={onDelete}
        className="mt-auto flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-critical-foreground transition-colors hover:bg-accent"
      >
        <Trash2 className="size-4" /> Delete step
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

export function WorkflowCanvas({ issue }: { issue: Issue }) {
  return (
    <ReactFlowProvider>
      <Canvas issue={issue} />
    </ReactFlowProvider>
  )
}
