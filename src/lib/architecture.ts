// Pure logic for the architecture flowchart builder. Everything here is
// framework-agnostic and unit-tested; React Flow / persistence live at the edges.

import { MarkerType, type Node, type Edge } from '@xyflow/react'
import type { Architecture, ArchBlock, ArchBlockKind, ArchKindDef, ArchLink } from '../types'

/** Visual identity per built-in block kind — used on the canvas and toolbar. */
export const BLOCK_KINDS: Record<ArchBlockKind, { label: string; color: string; icon: string }> = {
  service: { label: 'Service', color: '#e0a020', icon: '⚙️' },
  datastore: { label: 'Data store', color: '#3fb950', icon: '🗄️' },
  external: { label: 'External API', color: '#a371f7', icon: '🌐' },
  client: { label: 'Client', color: '#58a6ff', icon: '💻' },
  queue: { label: 'Queue / bus', color: '#d29922', icon: '📨' },
  note: { label: 'Note', color: '#8b949e', icon: '📝' },
  group: { label: 'Group', color: '#6e7681', icon: '🗂️' },
  image: { label: 'Image', color: '#f78166', icon: '🖼️' },
  'shape-rect': { label: 'Rectangle', color: '#58a6ff', icon: '▭' },
  'shape-circle': { label: 'Circle', color: '#3fb950', icon: '⬤' },
  'shape-diamond': { label: 'Diamond', color: '#e0a020', icon: '◆' },
  freehand: { label: 'Pen', color: '#a371f7', icon: '✏️' },
}

/** Palette offered by the colour picker. Readable on the dark canvas. */
export const BLOCK_COLORS = [
  '#e0a020',
  '#3fb950',
  '#a371f7',
  '#58a6ff',
  '#d29922',
  '#f78166',
  '#ff7b72',
  '#39c5cf',
  '#8b949e',
]

/** Default size for the blocks that need one — groups, notes and images. */
export const DEFAULT_SIZES: Record<string, { width: number; height: number }> = {
  group: { width: 320, height: 220 },
  note: { width: 180, height: 90 },
  image: { width: 200, height: 140 },
  'shape-rect': { width: 140, height: 90 },
  'shape-circle': { width: 130, height: 130 },
  'shape-diamond': { width: 170, height: 170 },
}

function isBuiltInKind(kind: string): kind is ArchBlockKind {
  return kind in BLOCK_KINDS
}

/**
 * Drawing primitives are registered in `BLOCK_KINDS` (so `resolveKind` /
 * `toFlowNodes` know how to render them) but deliberately excluded from
 * `availableKinds()` below — that's what the Architectures view's "Add block"
 * toolbar draws from, and these are offered only via MilestoneCanvas's own
 * fixed toolbar. Keeps "shapes + pen on Milestones only, not Architectures"
 * true even though both canvases share this same rendering engine.
 */
const CANVAS_PRIMITIVE_KINDS: ReadonlySet<string> = new Set(['shape-rect', 'shape-circle', 'shape-diamond', 'freehand'])

/**
 * Resolve a block's kind to its visual identity, whether it is one of ours or
 * one Sriram defined. Unknown ids fall back to `service` rather than throwing:
 * a diagram that references a deleted custom kind should still render.
 */
export function resolveKind(
  arch: Architecture,
  kind: string,
): { label: string; color: string; icon: string } {
  if (isBuiltInKind(kind)) return BLOCK_KINDS[kind]
  const custom = arch.kinds?.find((k) => k.id === kind)
  return custom ? { label: custom.label, color: custom.color, icon: custom.icon } : BLOCK_KINDS.service
}

/** Every kind available on this diagram: the built-ins plus Sriram's own. */
export function availableKinds(arch: Architecture): ArchKindDef[] {
  const builtIns = (Object.keys(BLOCK_KINDS) as ArchBlockKind[])
    .filter((id) => !CANVAS_PRIMITIVE_KINDS.has(id))
    .map((id) => ({ id, ...BLOCK_KINDS[id] }))
  return [...builtIns, ...(arch.kinds ?? [])]
}

let seq = 0
/** Monotonic id suffix. Deterministic within a session, unique enough for the canvas. */
function nextId(prefix: string, seed: number): string {
  return `${prefix}-${seed}-${seq++}`
}

/**
 * A fresh, empty architecture. `seed` (e.g. a timestamp) makes the id
 * stable/testable. `kinds` carries a custom-kind library forward from an
 * existing diagram, so a block type defined once is reusable.
 */
export function createArchitecture(name: string, seed: number, kinds: ArchKindDef[] = []): Architecture {
  const clean = name.trim() || 'Untitled architecture'
  return {
    id: `arch-${seed}`,
    name: clean,
    blocks: [],
    links: [],
    createdAt: seed,
    updatedAt: seed,
    ...(kinds.length ? { kinds } : {}),
  }
}

/** Add a block; returns a new architecture (never mutates). */
export function addBlock(
  arch: Architecture,
  kind: string,
  label: string,
  pos: { x: number; y: number },
  seed: number,
): Architecture {
  const identity = resolveKind(arch, kind)
  const size = DEFAULT_SIZES[kind]
  const block: ArchBlock = {
    id: nextId('block', seed),
    kind,
    label: label.trim() || identity.label,
    x: pos.x,
    y: pos.y,
    ...(size ?? {}),
  }
  return touch({ ...arch, blocks: [...arch.blocks, block] }, seed)
}

/**
 * Commit a freehand pen stroke. `points` are absolute canvas coordinates as
 * captured while dragging; this derives the bounding box and re-bases them
 * relative to it, the same convention every other block's geometry follows.
 */
export function addFreehandBlock(
  arch: Architecture,
  points: { x: number; y: number }[],
  seed: number,
  color = BLOCK_KINDS.freehand.color,
): Architecture {
  if (points.length < 2) return arch
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  // A couple of px of padding so the stroke doesn't clip flush against the
  // node's edge.
  const pad = 4
  const width = Math.max(...xs) - minX + pad * 2
  const height = Math.max(...ys) - minY + pad * 2
  const block: ArchBlock = {
    id: nextId('block', seed),
    kind: 'freehand',
    label: '',
    x: minX - pad,
    y: minY - pad,
    width,
    height,
    color,
    points: points.map((p) => ({ x: p.x - minX + pad, y: p.y - minY + pad })),
  }
  return touch({ ...arch, blocks: [...arch.blocks, block] }, seed)
}

/** Set (or clear, with undefined) a per-block colour override. */
export function setBlockColor(
  arch: Architecture,
  blockId: string,
  color: string | undefined,
  seed: number,
): Architecture {
  return touch(
    {
      ...arch,
      blocks: arch.blocks.map((b) => {
        if (b.id !== blockId) return b
        const { color: _drop, ...rest } = b
        return color ? { ...rest, color } : rest
      }),
    },
    seed,
  )
}

/** Persist a resize. Sizes are clamped so a block can't vanish or swallow the canvas. */
export function resizeBlock(
  arch: Architecture,
  blockId: string,
  size: { width: number; height: number },
  seed: number,
): Architecture {
  const width = Math.min(Math.max(Math.round(size.width), 60), 2000)
  const height = Math.min(Math.max(Math.round(size.height), 40), 2000)
  return touch(
    { ...arch, blocks: arch.blocks.map((b) => (b.id === blockId ? { ...b, width, height } : b)) },
    seed,
  )
}

/** Set the free-form body text of a block (sticky notes). */
export function setBlockText(arch: Architecture, blockId: string, text: string, seed: number): Architecture {
  return touch(
    {
      ...arch,
      blocks: arch.blocks.map((b) => {
        if (b.id !== blockId) return b
        const { text: _drop, ...rest } = b
        return text.trim() ? { ...rest, text } : rest
      }),
    },
    seed,
  )
}

/**
 * Put a block inside a group (or take it out with `undefined`).
 *
 * Refuses to nest a group inside itself or inside its own descendant — that
 * would build a cycle in the parent chain and hang any walk over it.
 */
export function setBlockParent(
  arch: Architecture,
  blockId: string,
  parentId: string | undefined,
  seed: number,
): Architecture {
  if (parentId === blockId) return arch
  if (parentId) {
    const parent = arch.blocks.find((b) => b.id === parentId)
    if (!parent) return arch
    // Walk up from the prospective parent; meeting blockId means a cycle.
    const seen = new Set<string>()
    let cursor: string | undefined = parentId
    while (cursor && !seen.has(cursor)) {
      if (cursor === blockId) return arch
      seen.add(cursor)
      cursor = arch.blocks.find((b) => b.id === cursor)?.parentId
    }
  }
  const block = arch.blocks.find((b) => b.id === blockId)
  if (!block) return arch
  // Coordinates are parent-relative, so re-base through absolute when the
  // containing group changes — otherwise the block leaps on reparent.
  const abs = absolutePosition(arch, block)
  const newParent = parentId ? arch.blocks.find((b) => b.id === parentId) : undefined
  const origin = newParent ? absolutePosition(arch, newParent) : { x: 0, y: 0 }

  return touch(
    {
      ...arch,
      blocks: arch.blocks.map((b) => {
        if (b.id !== blockId) return b
        const { parentId: _drop, ...rest } = b
        const rebased = { ...rest, x: abs.x - origin.x, y: abs.y - origin.y }
        return parentId ? { ...rebased, parentId } : rebased
      }),
    },
    seed,
  )
}

/**
 * Change a block's kind. If the block still carries the old kind's name as its
 * label, relabel it too — otherwise switching a "Service" to a "Pillar" leaves
 * a block called Service, which reads as a bug.
 */
export function setBlockKind(arch: Architecture, blockId: string, kind: string, seed: number): Architecture {
  return touch(
    {
      ...arch,
      blocks: arch.blocks.map((b) => {
        if (b.id !== blockId) return b
        const wasDefaultLabel = b.label === resolveKind(arch, b.kind).label
        return { ...b, kind, ...(wasDefaultLabel ? { label: resolveKind(arch, kind).label } : {}) }
      }),
    },
    seed,
  )
}

/** Set the image source of an `image` block. */
export function setBlockImage(arch: Architecture, blockId: string, src: string, seed: number): Architecture {
  return touch(
    { ...arch, blocks: arch.blocks.map((b) => (b.id === blockId ? { ...b, src } : b)) },
    seed,
  )
}

/** Update an edge's styling and/or label. Only the given fields change. */
export function updateLink(
  arch: Architecture,
  linkId: string,
  patch: Partial<Pick<ArchLink, 'label' | 'dashed' | 'curve' | 'noArrow' | 'color'>>,
  seed: number,
): Architecture {
  return touch(
    { ...arch, links: arch.links.map((l) => (l.id === linkId ? { ...l, ...patch } : l)) },
    seed,
  )
}

// ---- custom kinds ----------------------------------------------------------

/** Define a new block kind. Returns the architecture; the new id is `kind-<seed>-n`. */
export function addKind(
  arch: Architecture,
  def: { label: string; color: string; icon: string },
  seed: number,
): Architecture {
  const label = def.label.trim()
  if (!label) return arch
  const kind: ArchKindDef = {
    id: nextId('kind', seed),
    label,
    color: def.color || BLOCK_KINDS.service.color,
    icon: def.icon.trim() || '⬜',
  }
  return touch({ ...arch, kinds: [...(arch.kinds ?? []), kind] }, seed)
}

/** Edit a custom kind in place. */
export function updateKind(
  arch: Architecture,
  kindId: string,
  patch: Partial<Omit<ArchKindDef, 'id'>>,
  seed: number,
): Architecture {
  if (!arch.kinds?.some((k) => k.id === kindId)) return arch
  return touch(
    { ...arch, kinds: arch.kinds.map((k) => (k.id === kindId ? { ...k, ...patch } : k)) },
    seed,
  )
}

/**
 * Remove a custom kind. Blocks still using it fall back to `service` — dropping
 * the blocks too would lose real work over a palette edit.
 */
export function removeKind(arch: Architecture, kindId: string, seed: number): Architecture {
  if (!arch.kinds?.some((k) => k.id === kindId)) return arch
  return touch(
    {
      ...arch,
      kinds: arch.kinds.filter((k) => k.id !== kindId),
      blocks: arch.blocks.map((b) => (b.kind === kindId ? { ...b, kind: 'service' } : b)),
    },
    seed,
  )
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

/**
 * Remove a block and any links touching it. Children of a deleted group are
 * released rather than deleted with it — losing a diagram's contents because a
 * container was removed is not a trade anyone wants to make by accident.
 */
export function removeBlock(arch: Architecture, blockId: string, seed: number): Architecture {
  const removed = arch.blocks.find((b) => b.id === blockId)
  return touch(
    {
      ...arch,
      blocks: arch.blocks
        .filter((b) => b.id !== blockId)
        .map((b) => {
          if (b.parentId !== blockId) return b
          // A child's x/y are relative to its group, so a released child has to
          // be re-based to absolute or it jumps across the canvas.
          const { parentId: _drop, ...rest } = b
          return { ...rest, x: b.x + (removed?.x ?? 0), y: b.y + (removed?.y ?? 0) }
        }),
      links: arch.links.filter((l) => l.source !== blockId && l.target !== blockId),
    },
    seed,
  )
}

/** Absolute canvas position of a block, walking up any chain of groups. */
export function absolutePosition(arch: Architecture, block: ArchBlock): { x: number; y: number } {
  let x = block.x
  let y = block.y
  const seen = new Set<string>([block.id])
  let parentId = block.parentId
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId)
    const parent = arch.blocks.find((b) => b.id === parentId)
    if (!parent) break
    x += parent.x
    y += parent.y
    parentId = parent.parentId
  }
  return { x, y }
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

/**
 * Order blocks so every group precedes its children.
 *
 * React Flow requires a parent node to appear before the nodes that reference
 * it, and silently drops children that break the rule — so this is load-bearing,
 * not cosmetic. Blocks with a missing or cyclic parent still come out exactly
 * once.
 */
export function orderForFlow(blocks: ArchBlock[]): ArchBlock[] {
  const byId = new Map(blocks.map((b) => [b.id, b]))
  const out: ArchBlock[] = []
  const placed = new Set<string>()

  const place = (block: ArchBlock, chain: Set<string>) => {
    if (placed.has(block.id) || chain.has(block.id)) return
    chain.add(block.id)
    const parent = block.parentId ? byId.get(block.parentId) : undefined
    if (parent) place(parent, chain)
    if (placed.has(block.id)) return
    placed.add(block.id)
    out.push(block)
  }

  for (const block of blocks) place(block, new Set())
  return out
}

/** Project an architecture onto React Flow nodes. Pure. */
export function toFlowNodes(arch: Architecture): Node[] {
  return orderForFlow(arch.blocks).map((b) => {
    const kind = resolveKind(arch, b.kind)
    const color = b.color ?? kind.color
    const isGroup = b.kind === 'group'
    const isImage = b.kind === 'image'
    const isFreehand = b.kind === 'freehand'
    const isShapeRect = b.kind === 'shape-rect'
    const isShapeCircle = b.kind === 'shape-circle'
    const isShapeDiamond = b.kind === 'shape-diamond'
    const isShape = isShapeRect || isShapeCircle || isShapeDiamond
    // Bare canvas primitives skip the default box chrome — a freehand stroke
    // draws its own line, and a shape's fill/outline stands on its own without
    // the usual icon-plus-label block styling.
    const bare = isShape || isFreehand

    // A circle/diamond's clip-path only clips the OUTER box — a label centred
    // with the default flat padding still lays out at full box width, so it
    // overflows the diamond's taper and gets chopped mid-line rather than
    // wrapping inside it. Padding percentages don't fix this (CSS resolves
    // them against the *containing* block's width, not this element's own),
    // so this insets by the actual pixel size instead, computed to match each
    // shape's largest axis-aligned inscribed rectangle: 50% of each dimension
    // for a diamond, ~70.7% (1/√2) for a circle.
    const w = b.width ?? DEFAULT_SIZES[b.kind]?.width ?? 120
    const h = b.height ?? DEFAULT_SIZES[b.kind]?.height ?? 80
    const shapeInset = isShapeDiamond
      ? { top: h * 0.25, side: w * 0.25 }
      : isShapeCircle
        ? { top: h * 0.1464, side: w * 0.1464 }
        : null

    const style: Record<string, unknown> = {
      background: isFreehand ? 'transparent' : isGroup ? 'rgba(110, 118, 129, 0.08)' : isShape ? `${color}22` : '#161b22',
      color: '#e6edf3',
      border: isFreehand ? 'none' : `1.5px solid ${color}`,
      borderRadius: isShapeCircle ? '50%' : isShapeRect ? 4 : 8,
      fontSize: 12,
      boxSizing: 'border-box',
      padding: isImage || isFreehand ? 0 : shapeInset ? `${shapeInset.top}px ${shapeInset.side}px` : 6,
      minWidth: bare ? 0 : 120,
      ...(isShapeDiamond ? { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' } : {}),
      ...(b.width ? { width: b.width } : {}),
      ...(b.height ? { height: b.height } : {}),
    }
    // A group has to sit behind its children or it covers them, and its label
    // belongs at the top rather than centred behind the blocks it contains.
    if (isGroup) {
      style.zIndex = -1
      style.borderStyle = 'dashed'
      style.display = 'flex'
      style.alignItems = 'flex-start'
      style.justifyContent = 'flex-start'
    }

    return {
      id: b.id,
      type: 'arch',
      position: { x: b.x, y: b.y },
      data: { label: isGroup || isImage || bare ? b.label : `${kind.icon} ${b.label}`, block: b, color },
      style,
      ...(b.parentId ? { parentId: b.parentId, extent: 'parent' as const } : {}),
    }
  })
}

/** Project an architecture onto React Flow edges. Pure. */
export function toFlowEdges(arch: Architecture): Edge[] {
  return arch.links.map((l) => {
    const stroke = l.color ?? '#a86f10'
    return {
      id: l.id,
      source: l.source,
      target: l.target,
      label: l.label,
      animated: !l.dashed,
      type: l.curve === 'straight' ? 'straight' : l.curve === 'step' ? 'smoothstep' : 'default',
      style: { stroke, ...(l.dashed ? { strokeDasharray: '6 4' } : {}) },
      ...(l.noArrow ? {} : { markerEnd: { type: MarkerType.ArrowClosed, color: stroke } }),
    }
  })
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
