import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
} from '@xyflow/react'
import type { ArchBlockKind } from '../types'
import { BLOCK_KINDS, toFlowEdges, toFlowNodes } from '../lib/architecture'
import type { ArchitecturesApi } from '../hooks/useArchitectures'

const KIND_ORDER: ArchBlockKind[] = ['client', 'service', 'datastore', 'queue', 'external', 'note']

/**
 * Editable architecture canvas. Nodes/edges are projected from the current
 * architecture and re-synced whenever it changes; local drags feel live and only
 * persist meaningful edits (position on drag-stop, connect, delete) back through
 * the hook so state stays serialisable.
 */
export default function ArchitectureCanvas({ api }: { api: ArchitecturesApi }) {
  const { current } = api
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Re-project whenever the underlying architecture (structure or identity) changes.
  useEffect(() => {
    setNodes(current ? toFlowNodes(current) : [])
    setEdges(current ? toFlowEdges(current) : [])
  }, [current, setNodes, setEdges])

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes)
      for (const c of changes) {
        if (c.type === 'position' && c.dragging === false && c.position) {
          api.reposition(c.id, c.position)
        }
      }
    },
    [onNodesChange, api],
  )

  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source && c.target) api.connect(c.source, c.target)
    },
    [api],
  )

  const onNodesDelete = useCallback(
    (deleted: Node[]) => deleted.forEach((n) => api.deleteBlock(n.id)),
    [api],
  )
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => deleted.forEach((e) => api.deleteLink(e.id)),
    [api],
  )

  // Double-click a node to rename it.
  const onNodeDoubleClick = useCallback(
    (_: unknown, node: Node) => {
      const current = String(node.data?.label ?? '').replace(/^\S+\s/, '')
      const next = window.prompt('Rename block', current)
      if (next != null) api.renameCurrentBlock(node.id, next)
    },
    [api],
  )

  const selectedCount = nodes.filter((n) => n.selected).length + edges.filter((e) => e.selected).length
  const deleteSelected = () => {
    nodes.filter((n) => n.selected).forEach((n) => api.deleteBlock(n.id))
    edges.filter((e) => e.selected).forEach((e) => api.deleteLink(e.id))
  }

  if (!current) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-xl border border-dashed border-ink-600 bg-ink-900 text-sm text-gray-500">
        Create a new architecture to start building.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Manual toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-600 bg-ink-800/80 p-2">
        <span className="px-1 text-[11px] uppercase tracking-wide text-gray-500">Add block</span>
        {KIND_ORDER.map((kind) => {
          const k = BLOCK_KINDS[kind]
          return (
            <button
              key={kind}
              type="button"
              onClick={() => api.addManualBlock(kind)}
              className="flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-900 px-2.5 py-1.5 text-xs text-gray-200 transition-colors hover:border-syrup-700"
              style={{ boxShadow: `inset 3px 0 0 ${k.color}` }}
            >
              <span aria-hidden>{k.icon}</span>
              {k.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={deleteSelected}
          disabled={selectedCount === 0}
          className="ml-auto rounded-lg border border-ink-600 bg-ink-900 px-2.5 py-1.5 text-xs text-red-300 transition-colors hover:border-red-700 disabled:opacity-40"
        >
          🗑 Delete{selectedCount ? ` (${selectedCount})` : ''}
        </button>
      </div>

      {/* Canvas */}
      <div className="h-[460px] rounded-xl border border-ink-600 bg-ink-900">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onNodeDoubleClick={onNodeDoubleClick}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#30363d" gap={20} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-ink-800" maskColor="#0d111799" />
        </ReactFlow>
      </div>
      <p className="text-[11px] text-gray-600">
        Drag from a block's edge to connect · double-click to rename · select + Delete to remove
      </p>

      <ArchitectPrompt api={api} />
    </div>
  )
}

/** Prompt box that dispatches to the architect runner and merges the result. */
function ArchitectPrompt({ api }: { api: ArchitecturesApi }) {
  const [prompt, setPrompt] = useState('')

  const send = async () => {
    if (!prompt.trim() || api.building) return
    await api.buildFromPrompt(prompt)
    setPrompt('')
  }

  return (
    <div className="rounded-xl border border-ink-600 bg-ink-800/80 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-syrup-100">🪄 Build from a prompt</span>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wide"
          style={{
            backgroundColor: api.architectKind === 'orchestrator' ? '#3fb95022' : '#8b949e22',
            color: api.architectKind === 'orchestrator' ? '#3fb950' : '#8b949e',
          }}
          title={
            api.architectKind === 'orchestrator'
              ? 'Sends the prompt to your orchestrator / Claude endpoint'
              : 'Stub — parses keywords locally; set VITE_OS_ORCHESTRATOR_BASE for real generation'
          }
        >
          {api.architectKind === 'orchestrator' ? 'live' : 'stub'}
        </span>
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send()
        }}
        rows={2}
        placeholder='Describe the architecture… e.g. "web client, auth service, postgres, stripe webhook"'
        className="w-full resize-y rounded-lg border border-ink-600 bg-ink-900 p-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-syrup-700 focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-3">
        <span className="text-[10px] text-gray-600">⌘/Ctrl + Enter · blocks append to the canvas</span>
        {api.buildNote && <span className="truncate text-[11px] text-gray-400">{api.buildNote}</span>}
        <button
          type="button"
          onClick={send}
          disabled={!prompt.trim() || api.building}
          className="ml-auto rounded-lg bg-syrup-500 px-4 py-1.5 text-xs font-semibold text-ink-900 transition-colors hover:bg-syrup-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {api.building ? 'Building…' : 'Build'}
        </button>
      </div>
    </div>
  )
}
