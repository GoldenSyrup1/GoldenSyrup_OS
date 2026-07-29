import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { BLOCK_COLORS, availableKinds, toFlowEdges, toFlowNodes } from '../lib/architecture'
import type { ArchitecturesApi } from '../hooks/useArchitectures'
import ArchBlockNode from './ArchBlockNode'
import ArchInspector from './ArchInspector'

/** Built-ins in drawing order; custom kinds are appended after these. */
const KIND_ORDER: ArchBlockKind[] = [
  'client',
  'service',
  'datastore',
  'queue',
  'external',
  'note',
  'group',
  'image',
]

// Defined once at module scope: a fresh object each render makes React Flow
// remount every node.
const nodeTypes = { arch: ArchBlockNode }

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
        // Persist a drag-resize only once the handle is released, the same rule
        // the position case follows — otherwise every pixel writes to storage.
        if (c.type === 'dimensions' && c.resizing === false && c.dimensions) {
          api.resize(c.id, c.dimensions)
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

  // Double-click renames — except on a note, where the body text is the point.
  const onNodeDoubleClick = useCallback(
    (_: unknown, node: Node) => {
      const block = current?.blocks.find((b) => b.id === node.id)
      if (block?.kind === 'note') {
        const next = window.prompt('Note text', block.text ?? '')
        if (next != null) api.setText(node.id, next)
        return
      }
      const next = window.prompt('Rename block', block?.label ?? '')
      if (next != null) api.renameCurrentBlock(node.id, next)
    },
    [api, current],
  )

  const selectedNodes = nodes.filter((n) => n.selected)
  const selectedEdges = edges.filter((e) => e.selected)
  const selectedCount = selectedNodes.length + selectedEdges.length
  const deleteSelected = () => {
    selectedNodes.forEach((n) => api.deleteBlock(n.id))
    selectedEdges.forEach((e) => api.deleteLink(e.id))
  }

  // Drop the selected blocks into the one selected group, or release them.
  const groupSelected = () => {
    const group = selectedNodes.find((n) => current?.blocks.find((b) => b.id === n.id)?.kind === 'group')
    if (!group) return
    selectedNodes.filter((n) => n.id !== group.id).forEach((n) => api.setParent(n.id, group.id))
  }
  const ungroupSelected = () => selectedNodes.forEach((n) => api.setParent(n.id, undefined))

  const kinds = useMemo(() => {
    if (!current) return []
    const all = availableKinds(current)
    const order = new Map(KIND_ORDER.map((k, i) => [k as string, i]))
    // Built-ins in their drawing order first, then Sriram's own kinds.
    return [...all].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
  }, [current])

  const defineKind = () => {
    const label = window.prompt('New block kind — name it (e.g. "Pillar", "Ritual", "Person")')
    if (!label?.trim()) return
    const icon = window.prompt('An emoji for it', '⬜') ?? '⬜'
    const color = window.prompt(`A hex colour (one of ${BLOCK_COLORS.slice(0, 4).join(', ')}…)`, '#39c5cf')
    api.defineKind({ label, icon, color: color?.trim() || '#39c5cf' })
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
        {kinds.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => api.addManualBlock(k.id)}
            className="flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-900 px-2.5 py-1.5 text-xs text-gray-200 transition-colors hover:border-syrup-700"
            style={{ boxShadow: `inset 3px 0 0 ${k.color}` }}
          >
            <span aria-hidden>{k.icon}</span>
            {k.label}
          </button>
        ))}
        <button
          type="button"
          onClick={defineKind}
          title="Define your own block type — it persists and carries to new diagrams"
          className="rounded-lg border border-dashed border-ink-600 bg-ink-900 px-2.5 py-1.5 text-xs text-syrup-200 transition-colors hover:border-syrup-700"
        >
          ＋ New kind
        </button>

        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={groupSelected}
            disabled={selectedNodes.length < 2}
            title="Select a group plus the blocks to put inside it"
            className="rounded-lg border border-ink-600 bg-ink-900 px-2.5 py-1.5 text-xs text-gray-200 transition-colors hover:border-syrup-700 disabled:opacity-40"
          >
            🗂 Group
          </button>
          <button
            type="button"
            onClick={ungroupSelected}
            disabled={selectedNodes.length === 0}
            className="rounded-lg border border-ink-600 bg-ink-900 px-2.5 py-1.5 text-xs text-gray-200 transition-colors hover:border-syrup-700 disabled:opacity-40"
          >
            Ungroup
          </button>
          <button
            type="button"
            onClick={deleteSelected}
            disabled={selectedCount === 0}
            className="rounded-lg border border-ink-600 bg-ink-900 px-2.5 py-1.5 text-xs text-red-300 transition-colors hover:border-red-700 disabled:opacity-40"
          >
            🗑 Delete{selectedCount ? ` (${selectedCount})` : ''}
          </button>
        </span>
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
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#30363d" gap={20} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-ink-800" maskColor="#0d111799" />
        </ReactFlow>
      </div>
      <p className="text-[11px] text-gray-600">
        Drag from a block's edge to connect · double-click to rename (or edit a note's text) ·
        drag a corner to resize · select + Delete to remove
      </p>

      <ArchInspector
        api={api}
        selectedBlockId={selectedNodes.length === 1 ? selectedNodes[0].id : null}
        selectedLinkId={selectedEdges.length === 1 ? selectedEdges[0].id : null}
      />

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
        {/* Where this diagram lives decides whether any agent can ever see it. */}
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wide"
          style={{
            backgroundColor: api.storeKind === 'orchestrator' ? '#3fb95022' : '#8b949e22',
            color: api.storeKind === 'orchestrator' ? '#3fb950' : '#8b949e',
          }}
          title={
            api.storeKind === 'orchestrator'
              ? 'Saved to architectures/ on disk — agents working in this repo can read it'
              : 'Browser localStorage only — invisible to agents, and lost with the browser cache'
          }
        >
          {api.storeKind === 'orchestrator' ? 'on disk' : 'browser only'}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wide"
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
        {api.storeError && (
          <span className="truncate text-[11px] text-red-400" title={api.storeError}>
            ⚠ not saved to disk: {api.storeError}
          </span>
        )}
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
