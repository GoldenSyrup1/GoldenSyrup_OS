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
        const list = parseArchitectures(JSON.stringify(body.architectures ?? []))
        saveArchitectures(list)
        return list
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
