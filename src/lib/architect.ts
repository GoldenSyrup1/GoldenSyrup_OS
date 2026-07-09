// The architect runner is the seam between the "describe an architecture" prompt
// box and a graph the canvas can draw — the same stub/orchestrator split as
// runner.ts. A prompt resolves to an ArchGraphPatch (blocks + index-based links)
// which the hook lays out and merges onto the canvas in real time.
//   • stubArchitect        — deterministic keyword parse, no infra, no cost
//   • orchestratorArchitect— POSTs the prompt to a backend / Claude that returns JSON
// pickArchitect() chooses the real one when VITE_OS_ORCHESTRATOR_BASE is set.

import type { ArchBlockKind } from '../types'
import { env } from './env'

/** A block the runner wants drawn (position is assigned by the layout step). */
export interface PatchBlock {
  kind: ArchBlockKind
  label: string
}

/** A link between two patch blocks, by their index in `blocks`. */
export interface PatchLink {
  from: number
  to: number
  label?: string
}

/** What a prompt resolves to: blocks + links to merge onto the canvas. */
export interface ArchGraphPatch {
  blocks: PatchBlock[]
  links: PatchLink[]
  /** Human-readable note about what was generated (shown under the prompt). */
  note?: string
}

export interface Architect {
  readonly kind: 'stub' | 'orchestrator'
  /** Turn a natural-language prompt into a graph patch. */
  build(prompt: string): Promise<ArchGraphPatch>
}

// ---- stub: deterministic keyword parse -------------------------------------

interface Rule {
  test: RegExp
  kind: ArchBlockKind
  label: string
}

// Ordered so the canonical request→service→store spine comes first, then
// optional pieces the prompt hints at. Deterministic ⇒ unit-testable.
const RULES: Rule[] = [
  { test: /\b(client|frontend|ui|web|app|mobile|browser)\b/i, kind: 'client', label: 'Client' },
  { test: /\b(gateway|api|backend|server|service)\b/i, kind: 'service', label: 'API Service' },
  { test: /\b(auth|login|jwt|oauth|identity)\b/i, kind: 'service', label: 'Auth Service' },
  { test: /\b(queue|kafka|bus|event|pubsub|rabbit|sqs)\b/i, kind: 'queue', label: 'Message Queue' },
  { test: /\b(worker|job|cron|batch|pipeline)\b/i, kind: 'service', label: 'Worker' },
  { test: /\b(db|database|postgres|sql|store|storage|cache|redis|mongo)\b/i, kind: 'datastore', label: 'Data Store' },
  { test: /\b(stripe|payment|twilio|openai|claude|external|third[- ]?party|webhook)\b/i, kind: 'external', label: 'External API' },
]

/**
 * Parse a prompt into a plausible architecture. Matches known building blocks by
 * keyword and wires them into a linear spine (each block feeds the next), which is
 * a sensible default the user then edits with the manual toolbar. If nothing
 * matches, returns a minimal client→service→store skeleton so the canvas is never
 * empty after a prompt.
 */
export function parsePromptToPatch(prompt: string): ArchGraphPatch {
  const matched = RULES.filter((r) => r.test.test(prompt))
  const blocks: PatchBlock[] =
    matched.length > 0
      ? matched.map((r) => ({ kind: r.kind, label: r.label }))
      : [
          { kind: 'client', label: 'Client' },
          { kind: 'service', label: 'API Service' },
          { kind: 'datastore', label: 'Data Store' },
        ]
  // Wire a simple spine: block i → block i+1.
  const links: PatchLink[] = blocks.slice(1).map((_, i) => ({ from: i, to: i + 1 }))
  return {
    blocks,
    links,
    note: `${blocks.length} block${blocks.length === 1 ? '' : 's'} from your prompt — edit with the toolbar or refine and send again.`,
  }
}

export const stubArchitect: Architect = {
  kind: 'stub',
  async build(prompt) {
    // Small delay so the "building…" state is visible, mirroring runner.ts.
    await new Promise<void>((res) => setTimeout(res, 350))
    return parsePromptToPatch(prompt)
  },
}

// ---- orchestrator: real backend / Claude -----------------------------------

/** Defensively coerce an untrusted backend payload into an ArchGraphPatch. */
export function coercePatch(raw: unknown): ArchGraphPatch {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const validKinds = new Set<ArchBlockKind>(['service', 'datastore', 'external', 'client', 'queue', 'note'])
  const blocks: PatchBlock[] = Array.isArray(o.blocks)
    ? o.blocks
        .map((b): PatchBlock | null => {
          if (typeof b !== 'object' || b === null) return null
          const bo = b as Record<string, unknown>
          const kind = validKinds.has(bo.kind as ArchBlockKind) ? (bo.kind as ArchBlockKind) : 'service'
          const label = typeof bo.label === 'string' && bo.label.trim() ? bo.label : 'Block'
          return { kind, label }
        })
        .filter((b): b is PatchBlock => b !== null)
    : []
  const links: PatchLink[] = Array.isArray(o.links)
    ? o.links
        .map((l): PatchLink | null => {
          if (typeof l !== 'object' || l === null) return null
          const lo = l as Record<string, unknown>
          const from = Number(lo.from)
          const to = Number(lo.to)
          if (!Number.isInteger(from) || !Number.isInteger(to)) return null
          if (from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) return null
          return { from, to, label: typeof lo.label === 'string' ? lo.label : undefined }
        })
        .filter((l): l is PatchLink => l !== null)
    : []
  return { blocks, links, note: typeof o.note === 'string' ? o.note : undefined }
}

export function orchestratorArchitect(base: string): Architect {
  return {
    kind: 'orchestrator',
    async build(prompt) {
      const res = await fetch(`${base}/architect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      if (!res.ok) throw new Error(`architect endpoint responded ${res.status}`)
      return coercePatch(await res.json())
    },
  }
}

/** The active architect: orchestrator when configured, otherwise the stub. */
export function pickArchitect(): Architect {
  return env.orchestratorBase ? orchestratorArchitect(env.orchestratorBase) : stubArchitect
}
