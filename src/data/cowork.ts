// Cowork bridge adapter. Claude for Desktop's Cowork is desktop-only and stores
// project data locally with no cloud API (per Anthropic's docs), so we can't poll
// it directly. The bridge is a JSON file Cowork writes into a connected folder:
//   { "tasks": [ { id, title, category, status, progress, detail, updated } ] }
// The fetch is best-effort and the transforms are PURE (unit-tested); an absent or
// malformed file just yields an empty board rather than throwing.

import type { CoworkCategory, CoworkState, CoworkTask, Status } from '../types'
import { clampProgress } from '../lib/util'
import { env } from '../lib/env'
import { fetchJson } from './adapters'

const STATUSES: Status[] = ['live', 'progress', 'blocked', 'idle']

function coerceStatus(v: unknown): Status {
  return typeof v === 'string' && (STATUSES as string[]).includes(v) ? (v as Status) : 'idle'
}

/** Defensively normalise a raw bridge payload into CoworkState. Pure. */
export function normalizeCoworkState(raw: unknown): CoworkState {
  const root = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const arr = Array.isArray(root.tasks) ? root.tasks : Array.isArray(raw) ? (raw as unknown[]) : []
  const tasks = arr
    .map((t, i): CoworkTask | null => {
      if (typeof t !== 'object' || t === null) return null
      const o = t as Record<string, unknown>
      const title = typeof o.title === 'string' ? o.title : ''
      if (!title) return null
      return {
        id: typeof o.id === 'string' ? o.id : `task-${i}`,
        title,
        category: typeof o.category === 'string' && o.category.trim() ? o.category : 'Uncategorised',
        status: coerceStatus(o.status),
        progress: clampProgress(typeof o.progress === 'number' ? o.progress : 0),
        detail: typeof o.detail === 'string' ? o.detail : undefined,
        updated: typeof o.updated === 'string' ? o.updated : undefined,
      }
    })
    .filter((t): t is CoworkTask => t !== null)
  return {
    tasks,
    generatedAt: typeof root.generatedAt === 'string' ? root.generatedAt : undefined,
  }
}

/** Rank statuses so the "worst" one wins when rolling a category up. */
const STATUS_RANK: Record<Status, number> = { blocked: 3, progress: 2, idle: 1, live: 0 }

/**
 * Roll tasks up into categories: task count, weighted-average progress, and the
 * worst-case status (a single blocked task flags the whole category). Pure.
 * Category order follows first appearance so the side rail is stable.
 */
export function aggregateByCategory(tasks: CoworkTask[]): CoworkCategory[] {
  const order: string[] = []
  const groups = new Map<string, CoworkTask[]>()
  for (const t of tasks) {
    if (!groups.has(t.category)) {
      groups.set(t.category, [])
      order.push(t.category)
    }
    groups.get(t.category)!.push(t)
  }
  return order.map((name) => {
    const group = groups.get(name)!
    const progress = Math.round(group.reduce((s, t) => s + t.progress, 0) / group.length)
    const status = group.reduce<Status>(
      (worst, t) => (STATUS_RANK[t.status] > STATUS_RANK[worst] ? t.status : worst),
      'live',
    )
    return { name, taskCount: group.length, progress, status }
  })
}

/** Fetch the Cowork bridge snapshot. Best-effort: returns empty state on any failure. */
export async function fetchCoworkState(): Promise<CoworkState> {
  try {
    // Cache-bust so a locally rewritten file is picked up on each poll.
    const url = `${env.coworkStateUrl}${env.coworkStateUrl.includes('?') ? '&' : '?'}t=${pollToken()}`
    return normalizeCoworkState(await fetchJson<unknown>(url, { timeoutMs: 5000 }))
  } catch {
    return { tasks: [] }
  }
}

// A monotonically increasing token for cache-busting. Kept out of the pure
// transforms above so those stay deterministic for tests.
let counter = 0
function pollToken(): number {
  return ++counter
}
