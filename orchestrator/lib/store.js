// Architectures on disk, and the text form an agent actually reads.
//
// The canvas used to persist only to browser localStorage, which meant the
// diagrams Sriram draws were invisible to Claude Code, to Cowork, and to Claude
// — and died with the browser cache. The orchestrator has a filesystem, so it
// owns the durable copy: one JSON file per architecture under `architectures/`,
// committed alongside the repo so an agent working in this checkout can just
// read them.
//
// Deliberately free of `node:fs` and any SDK import, exactly like patch.js, so
// the root Vitest suite can unit-test it. The server does the actual I/O.

/** Hard cap on stored architectures, so a runaway client can't fill the disk. */
export const MAX_ARCHITECTURES = 100

/** Caps mirroring the canvas's own limits. */
const MAX_NAME = 80
const MAX_LABEL = 60
const MAX_BLOCKS_PER_ARCH = 200

/** Mirrors ArchBlockKind in src/types.ts. Keep in sync with patch.js. */
const ARCH_BLOCK_KINDS = new Set(['service', 'datastore', 'external', 'client', 'queue', 'note'])

function str(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function num(value, fallback) {
  return Number.isFinite(value) ? value : fallback
}

/**
 * Coerce one untrusted architecture into a storable shape, or null if it has no
 * usable identity. Blocks keep their canvas ids because links reference them;
 * a link pointing at a block that didn't survive is dropped rather than kept
 * dangling.
 */
export function sanitizeArchitecture(raw) {
  if (typeof raw !== 'object' || raw === null) return null
  const id = str(raw.id, 120)
  if (!id) return null

  const blocks = []
  const ids = new Set()
  for (const b of Array.isArray(raw.blocks) ? raw.blocks.slice(0, MAX_BLOCKS_PER_ARCH) : []) {
    if (typeof b !== 'object' || b === null) continue
    const blockId = str(b.id, 120)
    if (!blockId || ids.has(blockId)) continue
    ids.add(blockId)
    blocks.push({
      id: blockId,
      kind: ARCH_BLOCK_KINDS.has(b.kind) ? b.kind : 'service',
      label: str(b.label, MAX_LABEL) || 'Block',
      x: num(b.x, 0),
      y: num(b.y, 0),
    })
  }

  const links = []
  const seen = new Set()
  for (const l of Array.isArray(raw.links) ? raw.links : []) {
    if (typeof l !== 'object' || l === null) continue
    const source = str(l.source, 120)
    const target = str(l.target, 120)
    if (!ids.has(source) || !ids.has(target) || source === target) continue
    const key = `${source}->${target}`
    if (seen.has(key)) continue
    seen.add(key)
    const link = { id: str(l.id, 120) || `link-${key}`, source, target }
    const label = str(l.label, MAX_LABEL)
    if (label) link.label = label
    links.push(link)
  }

  const now = num(raw.updatedAt, 0)
  return {
    id,
    name: str(raw.name, MAX_NAME) || 'Untitled architecture',
    blocks,
    links,
    createdAt: num(raw.createdAt, now),
    updatedAt: now,
  }
}

/** Coerce a whole list, dropping unusable entries and duplicate ids. */
export function sanitizeArchitectures(raw) {
  const out = []
  const ids = new Set()
  for (const item of Array.isArray(raw) ? raw : []) {
    const arch = sanitizeArchitecture(item)
    if (!arch || ids.has(arch.id)) continue
    ids.add(arch.id)
    out.push(arch)
    if (out.length >= MAX_ARCHITECTURES) break
  }
  return out
}

/**
 * File name for an architecture: a readable slug plus the id.
 *
 * The id alone would make `architectures/` unreadable in a file tree, and the
 * slug alone would collide the moment two diagrams share a name (or rename into
 * each other), so the id is what actually guarantees uniqueness.
 */
export function archFileName(arch) {
  const slug =
    arch.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'architecture'
  // No dots in the id: stripping separators alone still leaves a literal `..`
  // sitting in a path we build, which is a trap waiting for the next person to
  // join these strings differently.
  const safeId = arch.id.replace(/[^a-zA-Z0-9_-]/g, '-')
  return `${slug}--${safeId}.json`
}

/**
 * Render an architecture as the plain text an agent reads. Positions are
 * dropped on purpose: pixel coordinates are noise to a model, the topology is
 * the signal.
 */
export function renderArchitecture(arch) {
  const byId = new Map(arch.blocks.map((b) => [b.id, b]))
  const lines = [`# Architecture: ${arch.name}`, '']

  if (arch.blocks.length === 0) {
    lines.push('(empty — no blocks drawn yet)')
    return lines.join('\n')
  }

  lines.push(`Blocks (${arch.blocks.length}):`)
  for (const b of arch.blocks) lines.push(`- ${b.label} [${b.kind}]`)

  lines.push('', `Connections (${arch.links.length}):`)
  if (arch.links.length === 0) {
    lines.push('- (none)')
  } else {
    for (const l of arch.links) {
      const from = byId.get(l.source)?.label ?? l.source
      const to = byId.get(l.target)?.label ?? l.target
      lines.push(`- ${from} -> ${to}${l.label ? ` (${l.label})` : ''}`)
    }
  }
  return lines.join('\n')
}

/**
 * Wrap a rendered architecture as a preamble for a /run prompt. Delimited so
 * the model can tell the diagram apart from the instruction that follows it.
 */
export function architectureContext(arch) {
  return [
    'The user has drawn the following architecture in GoldenSyrup OS.',
    'Treat it as context for the request that follows it.',
    '',
    '<architecture>',
    renderArchitecture(arch),
    '</architecture>',
    '',
  ].join('\n')
}
