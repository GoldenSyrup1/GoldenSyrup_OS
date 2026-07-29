// Where saved architectures live. Same stub ⇄ orchestrator seam as runner.ts
// and architect.ts:
//   • localArchStore        — browser localStorage only (no infra)
//   • orchestratorArchStore — the local orchestrator's `architectures/` dir
//
// The orchestrator store is the one that matters: a diagram in localStorage is
// invisible to Claude Code, to Cowork, and to Claude itself, and dies with the
// browser cache. On disk it is a file in this repo that an agent can read.
//
// It still writes through to localStorage, so the canvas survives the
// orchestrator being down and renders instantly on load instead of blank.

import type { Architecture } from '../types'
import { loadArchitectures, parseArchitectures, saveArchitectures } from './architecture'
import { env } from './env'

export interface ArchStore {
  readonly kind: 'local' | 'orchestrator'
  load(): Promise<Architecture[]>
  save(list: Architecture[]): Promise<void>
}

/**
 * Union two architecture lists by id, newest `updatedAt` winning a conflict.
 * Pure.
 *
 * This is what stops the switch to disk-backed storage from looking like data
 * loss: diagrams drawn before the orchestrator existed live only in
 * localStorage, and a plain "disk wins" load would show an empty canvas and
 * then overwrite them on the next edit. Adopting them instead means the first
 * run with the orchestrator up migrates old work onto disk.
 *
 * A local-only entry is safe to adopt because every save writes through to
 * localStorage — so a diagram deleted through the app is gone from both sides,
 * and one that exists only locally is one that never reached disk.
 */
export function mergeArchitectures(remote: Architecture[], local: Architecture[]): Architecture[] {
  const byId = new Map<string, Architecture>()
  for (const arch of [...remote, ...local]) {
    const existing = byId.get(arch.id)
    if (!existing || arch.updatedAt > existing.updatedAt) byId.set(arch.id, arch)
  }
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}

/** localStorage only. The offline default and the orchestrator store's cache. */
export const localArchStore: ArchStore = {
  kind: 'local',
  async load() {
    return loadArchitectures()
  },
  async save(list) {
    saveArchitectures(list)
  },
}

/**
 * Disk-backed store via the orchestrator, with localStorage as a write-through
 * cache.
 *
 * A failed *load* falls back to the cache — an unreachable orchestrator should
 * degrade to the old behaviour, not to an empty canvas. A failed *save* throws:
 * silently dropping a diagram the user believes is on disk is the one failure
 * worth interrupting them for.
 */
export function orchestratorArchStore(base: string): ArchStore {
  return {
    kind: 'orchestrator',
    async load() {
      try {
        const res = await fetch(`${base}/architectures`)
        if (!res.ok) throw new Error(`orchestrator responded ${res.status}`)
        const body = (await res.json()) as { architectures?: unknown }
        // Re-validate rather than trusting the wire, exactly as the server
        // re-validates what the browser sends it.
        const remote = parseArchitectures(JSON.stringify(body.architectures ?? []))
        // Merge rather than let disk win outright, so work drawn before the
        // orchestrator existed is adopted instead of appearing to vanish. The
        // hook writes the result straight back, which lands it on disk.
        const merged = mergeArchitectures(remote, loadArchitectures())
        saveArchitectures(merged)
        return merged
      } catch {
        return loadArchitectures()
      }
    },
    async save(list) {
      saveArchitectures(list)
      const res = await fetch(`${base}/architectures`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ architectures: list }),
      })
      if (!res.ok) throw new Error(`orchestrator responded ${res.status}`)
    },
  }
}

/** The active store: disk-backed when the orchestrator is configured. */
export function pickArchStore(): ArchStore {
  return env.orchestratorBase ? orchestratorArchStore(env.orchestratorBase) : localArchStore
}
