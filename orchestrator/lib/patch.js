// The wire contract between the orchestrator's /architect endpoint and the
// canvas: the JSON Schema Claude is constrained to, plus the coercion that
// turns its (already schema-valid) reply into a safe ArchGraphPatch.
//
// Deliberately free of any SDK import so the root Vitest suite can unit-test it.
// The browser re-validates with coercePatch() in src/lib/architect.ts — this is
// the server half of that defence, not a replacement for it.

/** Mirrors ArchBlockKind in src/types.ts. Keep the two in sync. */
export const ARCH_BLOCK_KINDS = new Set(['service', 'datastore', 'external', 'client', 'queue', 'note'])

/** Hard cap on blocks per patch, so one prompt can't flood the canvas. */
export const MAX_BLOCKS = 40

/** Longest label we keep; longer ones are truncated rather than rejected. */
const MAX_LABEL = 60

/**
 * The schema Claude's reply is constrained to via `output_config.format`.
 * Structured outputs require `additionalProperties: false` and every property
 * listed in `required`, so optional-in-spirit fields (label, note) are required
 * here and allowed to be empty instead.
 */
export const ARCHITECTURE_SCHEMA = {
  type: 'object',
  properties: {
    blocks: {
      type: 'array',
      description: 'The blocks to draw, ordered left-to-right by tier.',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: [...ARCH_BLOCK_KINDS] },
          label: { type: 'string', description: 'Short name, e.g. "Auth Service".' },
          col: { type: 'integer', description: 'Tier: 0 = entry point, higher = further from the user.' },
        },
        required: ['kind', 'label', 'col'],
        additionalProperties: false,
      },
    },
    links: {
      type: 'array',
      description: 'Directed edges between blocks, by their index in `blocks`.',
      items: {
        type: 'object',
        properties: {
          from: { type: 'integer', description: 'Index into `blocks`.' },
          to: { type: 'integer', description: 'Index into `blocks`.' },
          label: { type: 'string', description: 'Optional edge label; empty string for none.' },
        },
        required: ['from', 'to', 'label'],
        additionalProperties: false,
      },
    },
    note: { type: 'string', description: 'One sentence on what was generated.' },
  },
  required: ['blocks', 'links', 'note'],
  additionalProperties: false,
}

function coerceBlock(raw) {
  if (typeof raw !== 'object' || raw === null) return null
  const kind = ARCH_BLOCK_KINDS.has(raw.kind) ? raw.kind : 'service'
  const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim().slice(0, MAX_LABEL) : 'Block'
  const col = Number.isInteger(raw.col) && raw.col >= 0 ? raw.col : undefined
  return { kind, label, col }
}

/**
 * Coerce an untrusted /architect payload into an ArchGraphPatch.
 *
 * Dropping a malformed block would shift every later block's index and silently
 * mis-wire the links that refer to them, so surviving blocks are re-indexed and
 * links are remapped through that; a link to a dropped or capped-off block is
 * discarded rather than pointed at whatever slid into its place.
 */
export function toPatch(raw) {
  const o = typeof raw === 'object' && raw !== null ? raw : {}

  const remap = new Map()
  const blocks = []
  const rawBlocks = Array.isArray(o.blocks) ? o.blocks.slice(0, MAX_BLOCKS) : []
  rawBlocks.forEach((rawBlock, i) => {
    const block = coerceBlock(rawBlock)
    if (!block) return
    remap.set(i, blocks.length)
    blocks.push(block)
  })

  const seen = new Set()
  const links = []
  for (const rawLink of Array.isArray(o.links) ? o.links : []) {
    if (typeof rawLink !== 'object' || rawLink === null) continue
    const from = remap.get(rawLink.from)
    const to = remap.get(rawLink.to)
    if (from === undefined || to === undefined || from === to) continue
    const key = `${from}->${to}`
    if (seen.has(key)) continue
    seen.add(key)
    const label = typeof rawLink.label === 'string' && rawLink.label.trim() ? rawLink.label.trim() : undefined
    links.push({ from, to, label })
  }

  const note = typeof o.note === 'string' && o.note.trim() ? o.note.trim() : undefined
  return { blocks, links, note }
}
