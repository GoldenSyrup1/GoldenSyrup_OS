// Pure logic for the architecture flowchart builder. Everything here is
// framework-agnostic and unit-tested; React Flow / persistence live at the edges.

import type { Node, Edge } from '@xyflow/react'
import type { Architecture, ArchBlock, ArchBlockKind, ArchLink } from '../types'

/** Visual identity per block kind — colour + glyph used on the canvas and toolbar. */
export const BLOCK_KINDS: Record<ArchBlockKind, { label: string; color: string; icon: string }> = {
  service: { label: 'Service', color: '#e0a020', icon: '⚙️' },
  datastore: { label: 'Data store', color: '#3fb950', icon: '🗄️' },
  external: { label: 'External API', color: '#a371f7', icon: '🌐' },
  client: { label: 'Client', color: '#58a6ff', icon: '💻' },
  queue: { label: 'Queue / bus', color: '#d29922', icon: '📨' },
  note: { label: 'Note', color: '#8b949e', icon: '📝' },
}

let seq = 0
/** Monotonic id suffix. Deterministic within a session, unique enough for the canvas. */
function nextId(prefix: string, seed: number): string {
  return `${prefix}-${seed}-${seq++}`
}

/** A fresh, empty architecture. `seed` (e.g. a timestamp) makes the id stable/testable. */
export function createArchitecture(name: string, seed: number): Architecture {
  const clean = name.trim() || 'Untitled architecture'
  return { id: `arch-${seed}`, name: clean, blocks: [], links: [], createdAt: seed, updatedAt: seed }
}

/** Add a block; returns a new architecture (never mutates). */
export function addBlock(
  arch: Architecture,
  kind: ArchBlockKind,
  label: string,
  pos: { x: number; y: number },
  seed: number,
): Architecture {
  const block: ArchBlock = {
    id: nextId('block', seed),
    kind,
    label: label.trim() || BLOCK_KINDS[kind].label,
    x: pos.x,
    y: pos.y,
  }
  return touch({ ...arch, blocks: [...arch.blocks, block] }, seed)
}

/** Connect two blocks. No-op (returns input) for self-links or exact duplicates. */
export function connectBlocks(
  arch: Architecture,
  source: string,
  target: string,
  seed: number,
): Architecture {
  if (source === target) return arch
  if (arch.links.some((l) => l.source === source && l.target === target)) return arch
  const link: ArchLink = { id: nextId('link', seed), source, target }
  return touch({ ...arch, links: [...arch.links, link] }, seed)
}

/** Remove a block and any links touching it. */
export function removeBlock(arch: Architecture, blockId: string, seed: number): Architecture {
  return touch(
    {
      ...arch,
      blocks: arch.blocks.filter((b) => b.id !== blockId),
      links: arch.links.filter((l) => l.source !== blockId && l.target !== blockId),
    },
    seed,
  )
}

/** Rename a block. */
export function renameBlock(
  arch: Architecture,
  blockId: string,
  label: string,
  seed: number,
): Architecture {
  const clean = label.trim()
  if (!clean) return arch
  return touch(
    { ...arch, blocks: arch.blocks.map((b) => (b.id === blockId ? { ...b, label: clean } : b)) },
    seed,
  )
}

/** Persist new positions after a drag. */
export function moveBlock(
  arch: Architecture,
  blockId: string,
  pos: { x: number; y: number },
  seed: number,
): Architecture {
  return touch(
    { ...arch, blocks: arch.blocks.map((b) => (b.id === blockId ? { ...b, x: pos.x, y: pos.y } : b)) },
    seed,
  )
}

/** Remove a link by id. */
export function removeLink(arch: Architecture, linkId: string, seed: number): Architecture {
  return touch({ ...arch, links: arch.links.filter((l) => l.id !== linkId) }, seed)
}

function touch(arch: Architecture, seed: number): Architecture {
  return { ...arch, updatedAt: seed }
}

// ---- React Flow projection -------------------------------------------------

/** Project an architecture onto React Flow nodes. Pure. */
export function toFlowNodes(arch: Architecture): Node[] {
  return arch.blocks.map((b) => {
    const kind = BLOCK_KINDS[b.kind]
    return {
      id: b.id,
      position: { x: b.x, y: b.y },
      data: { label: `${kind.icon} ${b.label}` },
      style: {
        background: '#161b22',
        color: '#e6edf3',
        border: `1.5px solid ${kind.color}`,
        borderRadius: 8,
        fontSize: 12,
        padding: 6,
        minWidth: 120,
      },
    }
  })
}

/** Project an architecture onto React Flow edges. Pure. */
export function toFlowEdges(arch: Architecture): Edge[] {
  return arch.links.map((l) => ({
    id: l.id,
    source: l.source,
    target: l.target,
    label: l.label,
    animated: true,
    style: { stroke: '#a86f10' },
  }))
}

// ---- persistence -----------------------------------------------------------

const LS_KEY = 'gsos.architectures.v1'

/** Defensively parse the persisted architecture list. Pure. */
export function parseArchitectures(raw: string | null): Architecture[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (a): a is Architecture =>
        a && typeof a.id === 'string' && typeof a.name === 'string' && Array.isArray(a.blocks) && Array.isArray(a.links),
    )
  } catch {
    return []
  }
}

export function loadArchitectures(): Architecture[] {
  if (typeof localStorage === 'undefined') return []
  return parseArchitectures(localStorage.getItem(LS_KEY))
}

export function saveArchitectures(list: Architecture[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LS_KEY, JSON.stringify(list))
}
