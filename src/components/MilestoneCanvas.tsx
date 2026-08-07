import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
} from '@xyflow/react'
import { DEFAULT_SIZES, toFlowEdges, toFlowNodes } from '../lib/architecture'
import type { MilestoneBoardApi } from '../hooks/useMilestoneBoard'
import ArchBlockNode from './ArchBlockNode'

const nodeTypes = { arch: ArchBlockNode }

type Tool = 'select' | 'shape-rect' | 'shape-circle' | 'shape-diamond' | 'pen'

const SHAPE_TOOLS: { tool: Tool; label: string; icon: string }[] = [
  { tool: 'shape-rect', label: 'Rectangle', icon: '▭' },
  { tool: 'shape-circle', label: 'Circle', icon: '⬤' },
  { tool: 'shape-diamond', label: 'Diamond', icon: '◆' },
]

/**
 * Milestones canvas — a Figma/Lucidchart-lite drawing surface, not just a
 * connect-the-boxes graph: shape tools + a freehand pen, on top of the same
 * React Flow / block engine `ArchitectureCanvas` uses. Deliberately its own
 * component (not a shared prop on `ArchitectureCanvas`) so these tools stay
 * scoped to Milestones this pass — see the redesign conversation for why.
 */
export default function MilestoneCanvas({ api }: { api: MilestoneBoardApi }) {
  return (
    <ReactFlowProvider>
      <Inner api={api} />
    </ReactFlowProvider>
  )
}

function Inner({ api }: { api: MilestoneBoardApi }) {
  const { board } = api
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [tool, setTool] = useState<Tool>('select')
  // Two coordinate spaces on purpose: `screen` (relative to the overlay div)
  // drives the live SVG preview, `flow` (via screenToFlowPosition) is what
  // gets committed — they diverge as soon as the canvas is panned or zoomed,
  // so the preview can't just reuse the committed points.
  const [drawing, setDrawing] = useState<{ screen: { x: number; y: number }[]; flow: { x: number; y: number }[] } | null>(
    null,
  )
  const overlayRef = useRef<HTMLDivElement>(null)
  const flow = useReactFlow()

  // Re-project on every board change — a hand-drawn edit, an external mutation
  // like a chat-appended milestone, or the initial seed resolving after mount.
  useEffect(() => {
    setNodes(board ? toFlowNodes(board) : [])
    setEdges(board ? toFlowEdges(board) : [])
  }, [board, setNodes, setEdges])

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes)
      for (const c of changes) {
        if (c.type === 'position' && c.dragging === false && c.position) api.reposition(c.id, c.position)
        if (c.type === 'dimensions' && c.resizing === false && c.dimensions) api.resize(c.id, c.dimensions)
      }
    },
    [onNodesChange, api],
  )

  const onConnect = useCallback((c: Connection) => c.source && c.target && api.connect(c.source, c.target), [api])
  const onNodesDelete = useCallback((deleted: Node[]) => deleted.forEach((n) => api.deleteBlock(n.id)), [api])
  const onEdgesDelete = useCallback((deleted: Edge[]) => deleted.forEach((e) => api.deleteLink(e.id)), [api])
  const onNodeDoubleClick = useCallback(
    (_: unknown, node: Node) => {
      const block = board?.blocks.find((b) => b.id === node.id)
      const next = window.prompt('Rename', block?.label ?? '')
      if (next != null) api.renameBlock(node.id, next)
    },
    [api, board],
  )

  const selectedNodes = nodes.filter((n) => n.selected)
  const selectedEdges = edges.filter((e) => e.selected)
  const selectedCount = selectedNodes.length + selectedEdges.length
  const deleteSelected = () => {
    selectedNodes.forEach((n) => api.deleteBlock(n.id))
    selectedEdges.forEach((e) => api.deleteLink(e.id))
  }

  // Shape tools: one click places a default-sized shape centred on the
  // cursor, then reverts to select — matches "click to drop a box" more than
  // "stay armed"; the pen stays armed instead, since a real drawing pass is
  // usually more than one stroke.
  const placeShape = (e: React.MouseEvent) => {
    if (tool === 'select' || tool === 'pen') return
    const pos = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const size = DEFAULT_SIZES[tool] ?? { width: 120, height: 80 }
    api.addShape(tool, { x: pos.x - size.width / 2, y: pos.y - size.height / 2 })
    setTool('select')
  }

  const pointFromEvent = (e: React.PointerEvent) => {
    const rect = overlayRef.current?.getBoundingClientRect()
    return {
      screen: { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) },
      flow: flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }),
    }
  }
  const penDown = (e: React.PointerEvent) => {
    if (tool !== 'pen') return
    const p = pointFromEvent(e)
    setDrawing({ screen: [p.screen], flow: [p.flow] })
  }
  const penMove = (e: React.PointerEvent) => {
    if (tool !== 'pen' || !drawing) return
    const p = pointFromEvent(e)
    setDrawing({ screen: [...drawing.screen, p.screen], flow: [...drawing.flow, p.flow] })
  }
  const penUp = () => {
    if (tool !== 'pen' || !drawing) return
    api.addStroke(drawing.flow)
    setDrawing(null)
  }

  if (!board) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-xl border border-dashed border-ink-600 bg-ink-900 text-sm text-gray-500">
        Loading Milestones…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-600 bg-ink-800/80 p-2">
        <span className="px-1 text-[11px] uppercase tracking-wide text-gray-500">Draw</span>
        <button
          type="button"
          onClick={() => setTool('select')}
          aria-pressed={tool === 'select'}
          title="Select / pan / connect"
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
            tool === 'select'
              ? 'border-syrup-700 bg-syrup-500/15 text-syrup-100'
              : 'border-ink-600 bg-ink-900 text-gray-200 hover:border-syrup-700'
          }`}
        >
          ↖ Select
        </button>
        {SHAPE_TOOLS.map((s) => (
          <button
            key={s.tool}
            type="button"
            onClick={() => setTool(s.tool)}
            aria-pressed={tool === s.tool}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
              tool === s.tool
                ? 'border-syrup-700 bg-syrup-500/15 text-syrup-100'
                : 'border-ink-600 bg-ink-900 text-gray-200 hover:border-syrup-700'
            }`}
          >
            <span aria-hidden>{s.icon}</span>
            {s.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setTool('pen')}
          aria-pressed={tool === 'pen'}
          title="Freehand pen — draw, then Select to stop"
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
            tool === 'pen'
              ? 'border-syrup-700 bg-syrup-500/15 text-syrup-100'
              : 'border-ink-600 bg-ink-900 text-gray-200 hover:border-syrup-700'
          }`}
        >
          ✏️ Pen
        </button>

        <button
          type="button"
          onClick={deleteSelected}
          disabled={selectedCount === 0}
          className="ml-auto rounded-lg border border-ink-600 bg-ink-900 px-2.5 py-1.5 text-xs text-red-300 transition-colors hover:border-red-700 disabled:opacity-40"
        >
          🗑 Delete{selectedCount ? ` (${selectedCount})` : ''}
        </button>
      </div>

      <div className="relative h-[460px] rounded-xl border border-ink-600 bg-ink-900">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={nodeTypes}
          panOnDrag={tool === 'select'}
          nodesDraggable={tool === 'select'}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#30363d" gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>

        {/* Drawing overlay — only intercepts pointer events while a tool other
            than Select is armed, so normal drag/pan/connect is untouched. */}
        {tool !== 'select' && (
          <div
            ref={overlayRef}
            role="presentation"
            className="absolute inset-0 cursor-crosshair"
            onClick={placeShape}
            onPointerDown={penDown}
            onPointerMove={penMove}
            onPointerUp={penUp}
            onPointerLeave={penUp}
          >
            {drawing && drawing.screen.length > 1 && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                <polyline
                  points={drawing.screen.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="#a371f7"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        )}
      </div>
      <p className="text-[11px] text-gray-600">
        Select mode: drag from a node's edge to connect · double-click to rename · drag a corner to resize ·
        select + Delete to remove · Rectangle/Circle/Diamond place a shape on click · Pen draws until you switch
        back to Select
      </p>
    </div>
  )
}
