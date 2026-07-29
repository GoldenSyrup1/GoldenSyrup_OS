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

// ---- full canvas: colours, sizes, groups, custom kinds, edge styling -------

import {
  absolutePosition,
  addKind,
  availableKinds,
  orderForFlow,
  removeKind,
  resizeBlock,
  resolveKind,
  setBlockColor,
  setBlockImage,
  setBlockParent,
  setBlockText,
  updateKind,
  updateLink,
  setBlockKind,
} from './architecture'

/** Architecture with `n` blocks added, returning ids alongside for convenience. */
function withBlocks(kinds: string[]) {
  let a = createArchitecture('Canvas', seed)
  for (const k of kinds) a = addBlock(a, k, '', { x: 10, y: 10 }, seed)
  return { arch: a, ids: a.blocks.map((b) => b.id) }
}

describe('custom kinds', () => {
  it('defines a kind and resolves blocks drawn with it', () => {
    let a = addKind(createArchitecture('K', seed), { label: 'Pillar', color: '#ff0000', icon: '🏛️' }, seed)
    const kindId = a.kinds![0].id
    a = addBlock(a, kindId, '', { x: 0, y: 0 }, seed)

    expect(resolveKind(a, kindId).label).toBe('Pillar')
    // An unlabelled block takes the custom kind's own name, not "Service".
    expect(a.blocks[0].label).toBe('Pillar')
  })

  it('ignores a kind with a blank label', () => {
    const a = addKind(createArchitecture('K', seed), { label: '  ', color: '#fff', icon: 'x' }, seed)
    expect(a.kinds).toBeUndefined()
  })

  it('edits a kind and ignores an unknown id', () => {
    let a = addKind(createArchitecture('K', seed), { label: 'Pillar', color: '#ff0000', icon: '🏛️' }, seed)
    const kindId = a.kinds![0].id
    a = updateKind(a, kindId, { label: 'Domain' }, seed)
    expect(a.kinds![0].label).toBe('Domain')
    expect(updateKind(a, 'nope', { label: 'x' }, seed)).toBe(a)
  })

  // Deleting a palette entry must not delete the work drawn with it.
  it('falls blocks back to service when their kind is deleted', () => {
    let a = addKind(createArchitecture('K', seed), { label: 'Pillar', color: '#ff0000', icon: '🏛️' }, seed)
    const kindId = a.kinds![0].id
    a = addBlock(a, kindId, 'Finance', { x: 0, y: 0 }, seed)
    a = removeKind(a, kindId, seed)

    expect(a.kinds).toEqual([])
    expect(a.blocks).toHaveLength(1)
    expect(a.blocks[0].kind).toBe('service')
    expect(a.blocks[0].label).toBe('Finance')
  })

  it('renders an unknown kind rather than throwing', () => {
    const a = createArchitecture('K', seed)
    expect(resolveKind(a, 'kind-that-was-deleted').label).toBe('Service')
  })

  it('offers built-ins plus custom kinds, and carries a library to a new diagram', () => {
    const a = addKind(createArchitecture('K', seed), { label: 'Pillar', color: '#f00', icon: '🏛️' }, seed)
    expect(availableKinds(a).map((k) => k.label)).toContain('Pillar')
    expect(availableKinds(a).map((k) => k.label)).toContain('Data store')

    const fresh = createArchitecture('Next', seed + 1, a.kinds)
    expect(fresh.kinds).toHaveLength(1)
    expect(createArchitecture('Bare', seed + 2).kinds).toBeUndefined()
  })
})

describe('block styling', () => {
  it('sets and clears a colour override', () => {
    const { arch, ids } = withBlocks(['service'])
    const painted = setBlockColor(arch, ids[0], '#ff7b72', seed)
    expect(painted.blocks[0].color).toBe('#ff7b72')
    expect(setBlockColor(painted, ids[0], undefined, seed).blocks[0]).not.toHaveProperty('color')
  })

  it('clamps a resize instead of letting a block vanish or swallow the canvas', () => {
    const { arch, ids } = withBlocks(['service'])
    expect(resizeBlock(arch, ids[0], { width: 5, height: 5 }, seed).blocks[0]).toMatchObject({
      width: 60,
      height: 40,
    })
    expect(resizeBlock(arch, ids[0], { width: 99999, height: 99999 }, seed).blocks[0]).toMatchObject({
      width: 2000,
      height: 2000,
    })
  })

  it('gives groups, notes and images a default size but not plain blocks', () => {
    const { arch } = withBlocks(['group', 'note', 'image', 'service'])
    expect(arch.blocks[0]).toMatchObject({ width: 320, height: 220 })
    expect(arch.blocks[1]).toMatchObject({ width: 180, height: 90 })
    expect(arch.blocks[3]).not.toHaveProperty('width')
  })

  it('sets body text and drops it when blanked', () => {
    const { arch, ids } = withBlocks(['note'])
    const noted = setBlockText(arch, ids[0], 'remember the XRPL escrow', seed)
    expect(noted.blocks[0].text).toBe('remember the XRPL escrow')
    expect(setBlockText(noted, ids[0], '   ', seed).blocks[0]).not.toHaveProperty('text')
  })

  it('sets an image source', () => {
    const { arch, ids } = withBlocks(['image'])
    expect(setBlockImage(arch, ids[0], 'data:image/png;base64,AAA', seed).blocks[0].src).toBe(
      'data:image/png;base64,AAA',
    )
  })
})

describe('groups', () => {
  it('parents a block and re-bases its coordinates so it does not jump', () => {
    let a = createArchitecture('G', seed)
    a = addBlock(a, 'group', 'Backend', { x: 100, y: 100 }, seed)
    a = addBlock(a, 'service', 'API', { x: 150, y: 130 }, seed)
    const [group, api] = a.blocks.map((b) => b.id)

    const parented = setBlockParent(a, api, group, seed)
    const child = parented.blocks.find((b) => b.id === api)!
    expect(child.parentId).toBe(group)
    // Relative to the group, but the same place on the canvas as before.
    expect({ x: child.x, y: child.y }).toEqual({ x: 50, y: 30 })
    expect(absolutePosition(parented, child)).toEqual({ x: 150, y: 130 })
  })

  it('un-parents back to the same absolute spot', () => {
    let a = createArchitecture('G', seed)
    a = addBlock(a, 'group', 'Backend', { x: 100, y: 100 }, seed)
    a = addBlock(a, 'service', 'API', { x: 150, y: 130 }, seed)
    const [group, api] = a.blocks.map((b) => b.id)

    const round = setBlockParent(setBlockParent(a, api, group, seed), api, undefined, seed)
    expect(round.blocks.find((b) => b.id === api)).toMatchObject({ x: 150, y: 130 })
  })

  // A cycle in the parent chain would hang any walk over it.
  it('refuses to nest a group inside itself or its own descendant', () => {
    let a = createArchitecture('G', seed)
    a = addBlock(a, 'group', 'Outer', { x: 0, y: 0 }, seed)
    a = addBlock(a, 'group', 'Inner', { x: 20, y: 20 }, seed)
    const [outer, inner] = a.blocks.map((b) => b.id)

    expect(setBlockParent(a, outer, outer, seed)).toBe(a)
    const nested = setBlockParent(a, inner, outer, seed)
    expect(setBlockParent(nested, outer, inner, seed)).toBe(nested)
    expect(setBlockParent(a, inner, 'ghost', seed)).toBe(a)
  })

  it('releases children when their group is deleted, keeping them on the canvas', () => {
    let a = createArchitecture('G', seed)
    a = addBlock(a, 'group', 'Backend', { x: 100, y: 100 }, seed)
    a = addBlock(a, 'service', 'API', { x: 150, y: 130 }, seed)
    const [group, api] = a.blocks.map((b) => b.id)
    a = setBlockParent(a, api, group, seed)

    const after = removeBlock(a, group, seed)
    expect(after.blocks).toHaveLength(1)
    expect(after.blocks[0]).not.toHaveProperty('parentId')
    // Re-based to absolute, so it stays where it looked.
    expect(after.blocks[0]).toMatchObject({ x: 150, y: 130 })
  })
})

describe('orderForFlow', () => {
  // React Flow silently drops a child that precedes its parent.
  it('puts every group before its children', () => {
    let a = createArchitecture('G', seed)
    a = addBlock(a, 'service', 'API', { x: 0, y: 0 }, seed)
    a = addBlock(a, 'group', 'Backend', { x: 0, y: 0 }, seed)
    const [api, group] = a.blocks.map((b) => b.id)
    a = setBlockParent(a, api, group, seed)

    const ordered = orderForFlow(a.blocks).map((b) => b.id)
    expect(ordered.indexOf(group)).toBeLessThan(ordered.indexOf(api))
    expect(ordered).toHaveLength(2)
  })

  it('emits each block exactly once even with a missing or cyclic parent', () => {
    const orphan = { id: 'a', kind: 'service', label: 'A', x: 0, y: 0, parentId: 'ghost' }
    const cycleA = { id: 'x', kind: 'group', label: 'X', x: 0, y: 0, parentId: 'y' }
    const cycleB = { id: 'y', kind: 'group', label: 'Y', x: 0, y: 0, parentId: 'x' }
    const ordered = orderForFlow([orphan, cycleA, cycleB])
    expect(ordered.map((b) => b.id).sort()).toEqual(['a', 'x', 'y'])
  })
})

describe('edge styling', () => {
  it('updates only the given fields', () => {
    let a = createArchitecture('E', seed)
    a = addBlock(a, 'client', 'C', { x: 0, y: 0 }, seed)
    a = addBlock(a, 'service', 'S', { x: 0, y: 0 }, seed)
    const [c, s] = a.blocks.map((b) => b.id)
    a = connectBlocks(a, c, s, seed)
    const linkId = a.links[0].id

    a = updateLink(a, linkId, { dashed: true, curve: 'step', label: 'async' }, seed)
    expect(a.links[0]).toMatchObject({ dashed: true, curve: 'step', label: 'async' })
    a = updateLink(a, linkId, { label: 'renamed' }, seed)
    expect(a.links[0]).toMatchObject({ dashed: true, label: 'renamed' })
  })

  it('projects styling onto React Flow edges', () => {
    let a = createArchitecture('E', seed)
    a = addBlock(a, 'client', 'C', { x: 0, y: 0 }, seed)
    a = addBlock(a, 'service', 'S', { x: 0, y: 0 }, seed)
    const [c, s] = a.blocks.map((b) => b.id)
    a = connectBlocks(a, c, s, seed)
    a = updateLink(a, a.links[0].id, { dashed: true, curve: 'straight', noArrow: true, color: '#39c5cf' }, seed)

    const [edge] = toFlowEdges(a)
    expect(edge.type).toBe('straight')
    expect(edge.animated).toBe(false)
    expect(edge.style).toMatchObject({ stroke: '#39c5cf', strokeDasharray: '6 4' })
    expect(edge.markerEnd).toBeUndefined()
  })

  it('draws an arrow by default', () => {
    let a = createArchitecture('E', seed)
    a = addBlock(a, 'client', 'C', { x: 0, y: 0 }, seed)
    a = addBlock(a, 'service', 'S', { x: 0, y: 0 }, seed)
    const [c, s] = a.blocks.map((b) => b.id)
    a = connectBlocks(a, c, s, seed)
    expect(toFlowEdges(a)[0].markerEnd).toBeDefined()
  })
})

describe('toFlowNodes with the full canvas', () => {
  it('carries size, colour override and parent onto the node', () => {
    let a = createArchitecture('N', seed)
    a = addBlock(a, 'group', 'Backend', { x: 0, y: 0 }, seed)
    a = addBlock(a, 'service', 'API', { x: 10, y: 10 }, seed)
    const [group, api] = a.blocks.map((b) => b.id)
    a = setBlockParent(a, api, group, seed)
    a = setBlockColor(a, api, '#ff7b72', seed)
    a = resizeBlock(a, api, { width: 200, height: 80 }, seed)

    const node = toFlowNodes(a).find((n) => n.id === api)!
    expect(node.parentId).toBe(group)
    expect(node.extent).toBe('parent')
    expect(node.style).toMatchObject({ width: 200, height: 80, border: '1.5px solid #ff7b72' })
  })

  it('sinks a group behind its children so it does not cover them', () => {
    const { arch } = withBlocks(['group'])
    expect(toFlowNodes(arch)[0].style).toMatchObject({ zIndex: -1 })
  })
})

describe('setBlockKind', () => {
  it('relabels a block that still carries its old kind name', () => {
    let a = addKind(createArchitecture('K', seed), { label: 'Pillar', color: '#f00', icon: '🏛️' }, seed)
    const kindId = a.kinds![0].id
    a = addBlock(a, 'service', '', { x: 0, y: 0 }, seed) // label defaults to "Service"
    a = setBlockKind(a, a.blocks[0].id, kindId, seed)
    expect(a.blocks[0]).toMatchObject({ kind: kindId, label: 'Pillar' })
  })

  it('keeps a label the user actually wrote', () => {
    let a = addKind(createArchitecture('K', seed), { label: 'Pillar', color: '#f00', icon: '🏛️' }, seed)
    const kindId = a.kinds![0].id
    a = addBlock(a, 'service', 'Booking API', { x: 0, y: 0 }, seed)
    a = setBlockKind(a, a.blocks[0].id, kindId, seed)
    expect(a.blocks[0]).toMatchObject({ kind: kindId, label: 'Booking API' })
  })
})
