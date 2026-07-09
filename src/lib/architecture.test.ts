import { describe, it, expect } from 'vitest'
import {
  createArchitecture,
  addBlock,
  connectBlocks,
  removeBlock,
  renameBlock,
  removeLink,
  toFlowNodes,
  toFlowEdges,
  parseArchitectures,
} from './architecture'

const seed = 1_000

describe('architecture graph ops', () => {
  it('creates an empty architecture with a trimmed name', () => {
    const a = createArchitecture('  My Arch  ', seed)
    expect(a.name).toBe('My Arch')
    expect(a.blocks).toEqual([])
    expect(a.links).toEqual([])
    expect(createArchitecture('   ', seed).name).toBe('Untitled architecture')
  })

  it('adds blocks and bumps updatedAt', () => {
    let a = createArchitecture('A', seed)
    a = addBlock(a, 'service', 'API', { x: 0, y: 0 }, 2_000)
    expect(a.blocks).toHaveLength(1)
    expect(a.blocks[0].label).toBe('API')
    expect(a.updatedAt).toBe(2_000)
  })

  it('defaults a blank block label to the kind label', () => {
    const a = addBlock(createArchitecture('A', seed), 'datastore', '  ', { x: 0, y: 0 }, seed)
    expect(a.blocks[0].label).toBe('Data store')
  })

  it('connects blocks but rejects self-links and duplicates', () => {
    let a = createArchitecture('A', seed)
    a = addBlock(a, 'client', 'C', { x: 0, y: 0 }, seed)
    a = addBlock(a, 'service', 'S', { x: 1, y: 1 }, seed)
    const [c, s] = a.blocks
    a = connectBlocks(a, c.id, s.id, seed)
    expect(a.links).toHaveLength(1)
    // duplicate is a no-op
    a = connectBlocks(a, c.id, s.id, seed)
    expect(a.links).toHaveLength(1)
    // self-link is a no-op
    a = connectBlocks(a, c.id, c.id, seed)
    expect(a.links).toHaveLength(1)
  })

  it('removing a block cascades to its links', () => {
    let a = createArchitecture('A', seed)
    a = addBlock(a, 'client', 'C', { x: 0, y: 0 }, seed)
    a = addBlock(a, 'service', 'S', { x: 1, y: 1 }, seed)
    const [c, s] = a.blocks
    a = connectBlocks(a, c.id, s.id, seed)
    a = removeBlock(a, c.id, seed)
    expect(a.blocks).toHaveLength(1)
    expect(a.links).toHaveLength(0)
  })

  it('renames a block, ignoring blank input', () => {
    let a = addBlock(createArchitecture('A', seed), 'service', 'Old', { x: 0, y: 0 }, seed)
    const id = a.blocks[0].id
    a = renameBlock(a, id, 'New', seed)
    expect(a.blocks[0].label).toBe('New')
    a = renameBlock(a, id, '   ', seed)
    expect(a.blocks[0].label).toBe('New')
  })

  it('removes a link by id', () => {
    let a = createArchitecture('A', seed)
    a = addBlock(a, 'client', 'C', { x: 0, y: 0 }, seed)
    a = addBlock(a, 'service', 'S', { x: 1, y: 1 }, seed)
    a = connectBlocks(a, a.blocks[0].id, a.blocks[1].id, seed)
    a = removeLink(a, a.links[0].id, seed)
    expect(a.links).toHaveLength(0)
  })
})

describe('React Flow projection', () => {
  it('maps blocks/links onto nodes/edges', () => {
    let a = createArchitecture('A', seed)
    a = addBlock(a, 'service', 'API', { x: 5, y: 7 }, seed)
    a = addBlock(a, 'datastore', 'DB', { x: 9, y: 3 }, seed)
    a = connectBlocks(a, a.blocks[0].id, a.blocks[1].id, seed)
    const nodes = toFlowNodes(a)
    const edges = toFlowEdges(a)
    expect(nodes).toHaveLength(2)
    expect(nodes[0].position).toEqual({ x: 5, y: 7 })
    expect(String(nodes[0].data.label)).toContain('API')
    expect(edges).toHaveLength(1)
    expect(edges[0].source).toBe(a.blocks[0].id)
  })
})

describe('parseArchitectures', () => {
  it('returns [] for null / malformed JSON', () => {
    expect(parseArchitectures(null)).toEqual([])
    expect(parseArchitectures('{not json')).toEqual([])
    expect(parseArchitectures('{"a":1}')).toEqual([])
  })

  it('keeps only well-shaped entries', () => {
    const good = { id: 'x', name: 'X', blocks: [], links: [], createdAt: 1, updatedAt: 1 }
    const raw = JSON.stringify([good, { id: 'y' }])
    expect(parseArchitectures(raw)).toHaveLength(1)
  })
})
