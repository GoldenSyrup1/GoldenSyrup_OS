import { describe, it, expect } from 'vitest'
import { buildGraph } from './RelationshipMap'
import type { Contact, Project } from '../types'

const projects: Project[] = [
  { id: 'weport', name: 'WEPort', status: 'live', progress: 95, summary: '', nextAction: '' },
]
const contacts: Contact[] = [
  {
    id: 'peter',
    name: 'Peter',
    role: 'mentor',
    relationship: 'mentor',
    connectsTo: ['weport'],
  },
  {
    id: 'loose',
    name: 'Loose End',
    role: 'peer',
    relationship: 'peer',
    connectsTo: [],
  },
]

describe('buildGraph', () => {
  it('creates one node per contact and project', () => {
    const { nodes } = buildGraph(contacts, projects)
    expect(nodes).toHaveLength(3)
    expect(nodes.find((n) => n.id === 'project:weport')).toBeTruthy()
    expect(nodes.find((n) => n.id === 'contact:peter')).toBeTruthy()
  })
  it('creates edges only for declared connections', () => {
    const { edges } = buildGraph(contacts, projects)
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({ source: 'contact:peter', target: 'project:weport' })
  })
})
