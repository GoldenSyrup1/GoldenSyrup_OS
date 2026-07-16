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
  /** Horizontal tier hint (0 = entry/left). The layout step places columns by this. */
  col?: number
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

/** The architectural part a keyword maps to — drives both labelling and wiring. */
type Role = 'client' | 'api' | 'auth' | 'queue' | 'worker' | 'datastore' | 'external'

interface Rule {
  test: RegExp
  role: Role
  kind: ArchBlockKind
  label: string
  /** Horizontal tier: entry points left, backing stores/integrations right. */
  col: number
}

// Ordered client → api → auth → queue → worker → store → external so matched
// blocks come out in a stable, left-to-right order. Deterministic ⇒ unit-testable.
const RULES: Rule[] = [
  { test: /\b(client|frontend|ui|web|app|mobile|browser)\b/i, role: 'client', kind: 'client', label: 'Client', col: 0 },
  { test: /\b(gateway|api|backend|server|service)\b/i, role: 'api', kind: 'service', label: 'API Service', col: 1 },
  { test: /\b(auth|login|jwt|oauth|identity)\b/i, role: 'auth', kind: 'service', label: 'Auth Service', col: 1 },
  { test: /\b(queue|kafka|bus|event|pubsub|rabbit|sqs)\b/i, role: 'queue', kind: 'queue', label: 'Message Queue', col: 2 },
  { test: /\b(worker|job|cron|batch|pipeline)\b/i, role: 'worker', kind: 'service', label: 'Worker', col: 2 },
  { test: /\b(db|database|postgres|sql|store|storage|cache|redis|mongo)\b/i, role: 'datastore', kind: 'datastore', label: 'Data Store', col: 3 },
  { test: /\b(stripe|payment|twilio|openai|claude|external|third[- ]?party|webhook)\b/i, role: 'external', kind: 'external', label: 'External API', col: 3 },
]

// The fallback skeleton when a prompt matches no keywords — a minimal
// client→api→store shape so the canvas is never empty after a prompt.
const FALLBACK: Rule[] = [RULES[0], RULES[1], RULES[5]]

/**
 * Wire matched blocks into a realistic topology (not a flat spine): the client
 * feeds the API, the API fans out to auth / queue / store, an async queue drives a
 * worker that also writes the store, and an external integration hangs off the
 * worker if there is one, else off the hub. Only edges whose endpoints both exist
 * are emitted. `at` maps a role to its block index in the matched set.
 */
function wire(at: Map<Role, number>): PatchLink[] {
  const links: PatchLink[] = []
  const has = (r: Role) => at.has(r)
  const push = (from: Role, to: Role) => {
    const f = at.get(from)
    const t = at.get(to)
    if (f !== undefined && t !== undefined && f !== t) links.push({ from: f, to: t })
  }
  // The hub is the API if present, else the client — whatever fans out to the rest.
  const hub: Role | undefined = has('api') ? 'api' : has('client') ? 'client' : undefined

  if (has('client') && has('api')) push('client', 'api')
  if (hub !== undefined) {
    push(hub, 'auth')
    push(hub, 'datastore')
    push(hub, 'queue')
  }
  // Async pipeline + external integration don't need the hub to exist.
  if (has('queue') && has('worker')) push('queue', 'worker')
  if (has('worker') && has('datastore')) push('worker', 'datastore')
  if (has('external')) {
    if (has('worker')) push('worker', 'external')
    else if (hub !== undefined) push(hub, 'external')
  }
  return links
}

/**
 * Parse a prompt into a plausible architecture by matching known building blocks by
 * keyword and wiring them into a realistic branching topology the user then edits
 * with the manual toolbar.
 */
export function parsePromptToPatch(prompt: string): ArchGraphPatch {
  const matched = RULES.filter((r) => r.test.test(prompt))
  const rules = matched.length > 0 ? matched : FALLBACK
  const blocks: PatchBlock[] = rules.map((r) => ({ kind: r.kind, label: r.label, col: r.col }))
  const at = new Map<Role, number>(rules.map((r, i) => [r.role, i]))
  const links = wire(at)
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
          const colNum = Number(bo.col)
          const col = Number.isInteger(colNum) && colNum >= 0 ? colNum : undefined
          return { kind, label, col }
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
