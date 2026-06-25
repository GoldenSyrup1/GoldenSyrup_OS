import { useMemo } from 'react'
import { ReactFlow, Background, Controls, type Node, type Edge } from '@xyflow/react'
import type { Contact, Project } from '../types'

/** Builds a contact↔project relationship graph for React Flow. Pure layout. */
export function buildGraph(contacts: Contact[], projects: Project[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  projects.forEach((p, i) => {
    nodes.push({
      id: `project:${p.id}`,
      position: { x: 320, y: i * 90 },
      data: { label: p.name },
      style: { background: '#21262d', color: '#e6edf3', border: '1px solid #e0a020', borderRadius: 8, fontSize: 12 },
    })
  })

  contacts.forEach((c, i) => {
    nodes.push({
      id: `contact:${c.id}`,
      position: { x: 0, y: i * 120 },
      data: { label: `${c.name}\n(${c.relationship})` },
      style: { background: '#161b22', color: '#f5c451', border: '1px solid #30363d', borderRadius: 8, fontSize: 12, whiteSpace: 'pre-line' },
    })
    for (const projId of c.connectsTo) {
      edges.push({
        id: `e:${c.id}-${projId}`,
        source: `contact:${c.id}`,
        target: `project:${projId}`,
        animated: true,
        style: { stroke: '#a86f10' },
      })
    }
  })

  return { nodes, edges }
}

export default function RelationshipMap({
  contacts,
  projects,
}: {
  contacts: Contact[]
  projects: Project[]
}) {
  const { nodes, edges } = useMemo(() => buildGraph(contacts, projects), [contacts, projects])

  return (
    <div className="h-[360px] rounded-xl border border-ink-600 bg-ink-900">
      <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
        <Background color="#30363d" gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
