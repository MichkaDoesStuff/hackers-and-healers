"use client"

import { useCallback, useMemo } from "react"
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
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import {
  Activity,
  Bell,
  Check,
  FileText,
  GitBranch,
  ListChecks,
  Plus,
  Zap,
} from "lucide-react"
import type { Issue, StepKind } from "@/lib/types"
import { buildWorkflow, type StepNode as StepNodeType } from "@/lib/workflows"
import { StepNode } from "./step-node"

const PALETTE: { kind: StepKind; label: string; icon: typeof Zap }[] = [
  { kind: "detect", label: "Detection", icon: Activity },
  { kind: "draft", label: "AI draft", icon: FileText },
  { kind: "order", label: "Order", icon: ListChecks },
  { kind: "notify", label: "Notify", icon: Bell },
  { kind: "decision", label: "Decision", icon: GitBranch },
  { kind: "resolve", label: "Resolve", icon: Check },
]

function Canvas({ issue }: { issue: Issue }) {
  const initial = useMemo(() => buildWorkflow(issue), [issue])
  const [nodes, setNodes, onNodesChange] = useNodesState<StepNodeType>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges)
  const { screenToFlowPosition } = useReactFlow()

  const nodeTypes = useMemo(() => ({ step: StepNode }), [])

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, animated: false }, eds)),
    [setEdges],
  )

  const addStep = useCallback(
    (kind: StepKind, label: string) => {
      const id = `n-${kind}-${Date.now()}`
      const position = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      })
      setNodes((nds) => [
        ...nds,
        {
          id,
          type: "step",
          position,
          data: {
            kind,
            title: `New ${label.toLowerCase()} step`,
            detail: "Double-click to describe this step",
            actor: "Loop",
          },
        },
      ])
    },
    [screenToFlowPosition, setNodes],
  )

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ style: { strokeWidth: 1.5 } }}
        minZoom={0.3}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="oklch(0.32 0.004 60)" />
        <Controls className="!border-border !bg-card [&_button]:!border-border [&_button]:!bg-card [&_button]:!fill-foreground [&_button:hover]:!bg-accent" />
        <MiniMap
          pannable
          zoomable
          className="!bg-card"
          maskColor="oklch(0.16 0.004 60 / 70%)"
          nodeColor="oklch(0.3 0.01 60)"
        />
      </ReactFlow>

      {/* palette */}
      <div className="absolute left-4 top-4 flex flex-col gap-1.5 rounded-xl border border-border bg-card/90 p-2 backdrop-blur">
        <span className="px-1 pb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Add step
        </span>
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
    </div>
  )
}

export function WorkflowCanvas({ issue }: { issue: Issue }) {
  return (
    <ReactFlowProvider>
      <Canvas issue={issue} />
    </ReactFlowProvider>
  )
}
