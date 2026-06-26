// Live data layer. Each adapter is best-effort: a thin fetch wrapper plus a PURE
// transform that maps the backend payload onto our domain types. The transforms
// are unit-tested; the fetchers fall back to the seed layer on any failure so the
// dashboard always renders.

import type { Pillar, Project, Status } from '../types'
import { clampProgress } from '../lib/util'
import { env, ETH_PRICE_URL } from '../lib/env'

export interface PillarSignal {
  pillar: string // id or display name
  signal?: string
  progress?: number
  status?: Status
}

/** A live status overlay for one project tile, matched by project id. */
export interface ProjectSignal {
  id: string
  status?: Status
  progress?: number
  summary?: string
  nextAction?: string
}

/** A claude_connector memory item (shape per /api/memory). */
export interface MemoryItem {
  created_at: string
  source: string
  tags: string[]
  content: string
}

/** Fetch JSON with a hard timeout + optional bearer token. Throws on non-2xx. */
export async function fetchJson<T>(
  url: string,
  opts: { timeoutMs?: number; token?: string } = {},
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: opts.token ? { Authorization: `Bearer ${opts.token}` } : {},
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

// ---- pure transforms (unit tested) ----------------------------------------

/** Overlay live pillar signals onto seeded pillars, matching by id or name. */
export function applyPillarSignals(pillars: Pillar[], signals: PillarSignal[]): Pillar[] {
  const byKey = new Map<string, PillarSignal>()
  for (const s of signals) {
    if (s?.pillar) byKey.set(String(s.pillar).toLowerCase(), s)
  }
  return pillars.map((p) => {
    const s = byKey.get(p.id.toLowerCase()) ?? byKey.get(p.name.toLowerCase())
    if (!s) return p
    return {
      ...p,
      signal: s.signal ?? p.signal,
      status: s.status ?? p.status,
      progress: typeof s.progress === 'number' ? clampProgress(s.progress) : p.progress,
    }
  })
}

/** Overlay live project signals onto seeded projects, matching by id. */
export function applyProjectSignals(projects: Project[], signals: ProjectSignal[]): Project[] {
  const byId = new Map<string, ProjectSignal>()
  for (const s of signals) {
    if (s?.id) byId.set(String(s.id).toLowerCase(), s)
  }
  return projects.map((p) => {
    const s = byId.get(p.id.toLowerCase())
    if (!s) return p
    return {
      ...p,
      status: s.status ?? p.status,
      progress: typeof s.progress === 'number' ? clampProgress(s.progress) : p.progress,
      summary: s.summary ?? p.summary,
      nextAction: s.nextAction ?? p.nextAction,
    }
  })
}

/** Parsed shape of WEPort's GET /api/health payload. */
export interface WeportHealth {
  ok: boolean
  version?: string
  database?: string
}

/** Defensively read WEPort's {status:"ok", version, database} health payload. */
export function parseWeportHealth(raw: unknown): WeportHealth {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    ok: o.status === 'ok',
    version: typeof o.version === 'string' ? o.version : undefined,
    database: typeof o.database === 'string' ? o.database : undefined,
  }
}

/**
 * Map a WEPort health result onto a ProjectSignal. A healthy API means the live
 * PCS demo is up (tile shows version + DB); an unhealthy/unreachable one downgrades
 * the tile to blocked so the dashboard surfaces an outage instead of stale "live".
 */
export function deriveWeportSignal(health: WeportHealth): ProjectSignal {
  if (!health.ok) {
    return { id: 'weport', status: 'blocked', summary: 'Backend unreachable — /api/health not OK' }
  }
  const detail = [health.version && `v${health.version}`, health.database].filter(Boolean).join(' · ')
  return { id: 'weport', status: 'live', summary: `Backend live${detail ? ` · ${detail}` : ''}` }
}

/** Defensively normalise an /api/memory response into MemoryItem[]. */
export function normalizeMemories(raw: unknown): MemoryItem[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { memories?: unknown[] })?.memories)
      ? (raw as { memories: unknown[] }).memories
      : []
  return arr
    .map((m): MemoryItem | null => {
      if (typeof m !== 'object' || m === null) return null
      const o = m as Record<string, unknown>
      const content = typeof o.content === 'string' ? o.content : ''
      if (!content) return null
      return {
        created_at: typeof o.created_at === 'string' ? o.created_at : '',
        source: typeof o.source === 'string' ? o.source : 'unknown',
        tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === 'string') : [],
        content,
      }
    })
    .filter((m): m is MemoryItem => m !== null)
}

/** Extract the USD ETH price from the CoinGecko simple-price payload. */
export function parseEthPrice(raw: unknown): number | null {
  const usd = (raw as { ethereum?: { usd?: unknown } })?.ethereum?.usd
  return typeof usd === 'number' && Number.isFinite(usd) ? usd : null
}

// ---- fetchers (best-effort, never throw) ----------------------------------

export async function fetchPillarSignals(): Promise<PillarSignal[]> {
  if (!env.intelBase) return []
  try {
    const data = await fetchJson<PillarSignal[]>(`${env.intelBase}/signals`)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function fetchRecentMemories(limit = 12): Promise<MemoryItem[]> {
  if (!env.connectorBase) return []
  try {
    const data = await fetchJson<unknown>(
      `${env.connectorBase}/api/memory?limit=${limit}&offset=0`,
      { token: env.connectorToken || undefined },
    )
    return normalizeMemories(data)
  } catch {
    return []
  }
}

export async function fetchEthPrice(): Promise<number | null> {
  try {
    return parseEthPrice(await fetchJson<unknown>(ETH_PRICE_URL, { timeoutMs: 6000 }))
  } catch {
    return null
  }
}

/**
 * Probe the WEPort backend's GET /api/health and report a live/blocked signal for
 * the weport tile. Dormant (returns []) until VITE_WEPORT_API_BASE is set, so it
 * never changes the seed layer in a default checkout. NOTE: WEPort locks CORS to a
 * fixed origin list — the dashboard's deployed origin must be added there or the
 * cross-origin fetch is blocked and the tile reports blocked despite a live API.
 */
export async function fetchWeportStatus(): Promise<ProjectSignal[]> {
  if (!env.weportBase) return []
  try {
    const raw = await fetchJson<unknown>(`${env.weportBase}/api/health`, { timeoutMs: 6000 })
    return [deriveWeportSignal(parseWeportHealth(raw))]
  } catch {
    return [deriveWeportSignal({ ok: false })]
  }
}
