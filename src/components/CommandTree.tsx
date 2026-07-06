import { useState } from 'react'
import type { CommandNode, Project } from '../types'
import { isLeaf } from '../lib/commandTree'
import { statusColor } from '../lib/util'

interface Props {
  nodes: CommandNode[]
  selectedId: string | null
  onSelect: (leaf: CommandNode) => void
  projects: Project[]
}

export default function CommandTree({ nodes, selectedId, onSelect, projects }: Props) {
  return (
    <ul className="space-y-1">
      {nodes.map((n) => (
        <TreeNode key={n.id} node={n} depth={0} selectedId={selectedId} onSelect={onSelect} projects={projects} />
      ))}
    </ul>
  )
}

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
  projects,
}: {
  node: CommandNode
  depth: number
  selectedId: string | null
  onSelect: (leaf: CommandNode) => void
  projects: Project[]
}) {
  const [open, setOpen] = useState(depth === 0)
  const leaf = isLeaf(node)
  const project = node.projectId ? projects.find((p) => p.id === node.projectId) : undefined
  const selected = selectedId === node.id

  if (leaf) {
    return (
      <li>
        <button
          type="button"
          onClick={() => onSelect(node)}
          style={{ paddingLeft: 8 + depth * 14 }}
          className={`flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm transition-colors ${
            selected ? 'bg-syrup-500/15 text-syrup-100' : 'text-gray-300 hover:bg-ink-700'
          }`}
        >
          {project && (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: statusColor(project.status) }}
              aria-hidden
            />
          )}
          <span className="truncate">{node.label}</span>
        </button>
      </li>
    )
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ paddingLeft: 8 + depth * 14 }}
        className="flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-xs font-semibold uppercase tracking-wide text-syrup-300 hover:bg-ink-700"
      >
        <span className="inline-block w-3 text-gray-500">{open ? '▾' : '▸'}</span>
        {node.icon && <span aria-hidden>{node.icon}</span>}
        <span className="truncate">{node.label}</span>
      </button>
      {open && node.children && (
        <ul className="mt-1 space-y-1">
          {node.children.map((c) => (
            <TreeNode key={c.id} node={c} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} projects={projects} />
          ))}
        </ul>
      )}
    </li>
  )
}
