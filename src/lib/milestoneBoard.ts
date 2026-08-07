// Pure logic for the Milestones board: seeding it from `Milestone[]`, and the
// deterministic `/milestone` chat command that appends to it. Framework-agnostic
// and unit-tested; the canvas/hook wiring lives at the edges, same split as
// `lib/architecture.ts`.

import type { Architecture, Milestone } from '../types'
import { addBlock, connectBlocks, createArchitecture, resolveKind } from './architecture'
import { sortByDate } from './dates'
import { statusColor } from './util'

export const MILESTONE_BOARD_ID = 'milestones'

/** Which drawing primitive represents each milestone kind on the board. */
export const KIND_SHAPE: Record<Milestone['kind'], string> = {
  hackathon: 'shape-diamond',
  unsw: 'shape-rect',
  event: 'shape-circle',
}

const COL_GAP = 200
const ROW_ZIGZAG = 70

/**
 * Build a fresh Milestones board from the seed `Milestone[]` — one shape per
 * milestone (kind picked via `KIND_SHAPE`, coloured by status), laid out
 * left-to-right in date order with a light zigzag and chained links, so it
 * reads as a graph rather than a straight line the first time it's opened.
 * Purely additive: `useMilestoneBoard` only calls this once, when the
 * persisted board is empty, so it never clobbers hand-drawn edits.
 */
export function seedMilestoneBoard(milestones: Milestone[], seed: number): Architecture {
  let arch = createArchitecture('Milestones', seed)
  arch = { ...arch, id: MILESTONE_BOARD_ID }
  let prevId: string | null = null

  sortByDate(milestones).forEach((m, i) => {
    const pos = { x: 60 + i * COL_GAP, y: 140 + (i % 2 === 0 ? 0 : ROW_ZIGZAG) }
    arch = addBlock(arch, KIND_SHAPE[m.kind], m.title, pos, seed + i)
    const block = arch.blocks[arch.blocks.length - 1]
    arch = { ...arch, blocks: arch.blocks.map((b) => (b.id === block.id ? { ...b, color: statusColor(m.status) } : b)) }
    if (prevId) arch = connectBlocks(arch, prevId, block.id, seed + i)
    prevId = block.id
  })

  return arch
}

/** Keyword → milestone kind, for the `/milestone <title> #tag` chat command. */
const KIND_TAGS: Record<string, Milestone['kind']> = {
  hackathon: 'hackathon',
  unsw: 'unsw',
  uni: 'unsw',
  event: 'event',
}

export interface ParsedMilestoneCommand {
  title: string
  kind: Milestone['kind']
}

/**
 * Deterministic stub parser for `/milestone <title> [#hackathon|#unsw|#event]`
 * typed into the chat input — the project's stub-first convention (see
 * `lib/architect.ts`) applied here: free-form "mention an achievement and it
 * just knows" needs an LLM call per message, so v1 is an explicit command
 * rather than a silent best-effort guess. Returns null for anything else,
 * including a bare `/milestone` with no title.
 */
export function parseMilestoneCommand(text: string): ParsedMilestoneCommand | null {
  const match = /^\/milestone\s+(.+)$/i.exec(text.trim())
  if (!match) return null

  let rest = match[1].trim()
  let kind: Milestone['kind'] = 'event'
  const tagMatch = /#(\w+)\b/.exec(rest)
  if (tagMatch) {
    const tag = KIND_TAGS[tagMatch[1].toLowerCase()]
    if (tag) {
      kind = tag
      rest = (rest.slice(0, tagMatch.index) + rest.slice(tagMatch.index + tagMatch[0].length)).trim()
    }
  }

  return rest ? { title: rest, kind } : null
}

/**
 * Append a new milestone node to the board, chained from whatever the
 * rightmost block currently is — the same "next column" placement
 * `useArchitectures.buildFromPrompt` uses, so a chat-added achievement lands
 * after the existing chain instead of overlapping it.
 */
export function appendMilestoneNode(arch: Architecture, parsed: ParsedMilestoneCommand, seed: number): Architecture {
  const rightmost = arch.blocks.reduce<{ id: string; x: number } | null>(
    (acc, b) => (!acc || b.x > acc.x ? { id: b.id, x: b.x } : acc),
    null,
  )
  const pos = { x: (rightmost?.x ?? 0) + COL_GAP, y: 140 }
  const kind = resolveKind(arch, KIND_SHAPE[parsed.kind])
  let next = addBlock(arch, KIND_SHAPE[parsed.kind], parsed.title, pos, seed)
  const added = next.blocks[next.blocks.length - 1]
  next = { ...next, blocks: next.blocks.map((b) => (b.id === added.id ? { ...b, color: kind.color } : b)) }
  if (rightmost) next = connectBlocks(next, rightmost.id, added.id, seed)
  return next
}

// ---- persistence -----------------------------------------------------------
// Its own localStorage key, deliberately not folded into `archStore`'s
// `architectures` list — Milestones is a separate board, not one more entry a
// user would see (and could delete) from the Architectures view's picker.
// Browser-only for this pass, same starting point Architectures itself had
// before it grew orchestrator-backed disk persistence.

const LS_KEY = 'gsos.milestone-board.v1'

/** Defensively parse the persisted board. Pure. Null if missing/invalid. */
export function parseMilestoneBoard(raw: string | null): Architecture | null {
  if (!raw) return null
  try {
    const a = JSON.parse(raw)
    if (a && typeof a.id === 'string' && Array.isArray(a.blocks) && Array.isArray(a.links)) return a as Architecture
    return null
  } catch {
    return null
  }
}

export function loadMilestoneBoard(): Architecture | null {
  if (typeof localStorage === 'undefined') return null
  return parseMilestoneBoard(localStorage.getItem(LS_KEY))
}

export function saveMilestoneBoard(board: Architecture): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LS_KEY, JSON.stringify(board))
}
