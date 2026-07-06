// The runner is the seam between the dashboard and "run this prompt with Claude
// Code". The UI only knows this interface, so we can swap execution backends:
//   • stubRunner        — simulates progress, no infra, no cost (the visible shell)
//   • orchestratorRunner— POSTs to a local process that runs `claude -p` per prompt
// pickRunner() chooses the real one when VITE_OS_ORCHESTRATOR_BASE is set.

import type { CommandNode, RunStatus } from '../types'
import { env } from './env'

/** An incremental update streamed while a run is in flight. */
export interface RunUpdate {
  log?: string
  status?: RunStatus
  result?: string
  error?: string
  costUsd?: number
}

export interface Runner {
  readonly kind: 'stub' | 'orchestrator'
  /** Dispatch a prompt; call onUpdate as progress streams; resolve when terminal. */
  submit(target: CommandNode, prompt: string, onUpdate: (u: RunUpdate) => void): Promise<void>
}

const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms))

const STUB_STEPS = [
  'Reading repo context…',
  'Searching for relevant code…',
  'Planning the change…',
  'Applying + self-verifying…',
]

/**
 * No-backend runner. Streams canned progress so the console is fully clickable
 * before the orchestrator exists. Reports $0 cost — it never calls a model.
 */
export const stubRunner: Runner = {
  kind: 'stub',
  async submit(target, prompt, onUpdate) {
    onUpdate({ status: 'running', log: `▸ dispatched to ${target.label}` })
    for (const step of STUB_STEPS) {
      await delay(550)
      onUpdate({ log: step })
    }
    await delay(400)
    onUpdate({
      status: 'done',
      costUsd: 0,
      result:
        `(stub) Would run Claude Code in ${target.path ?? target.label}:\n` +
        `"${prompt}"\n\n` +
        'Set VITE_OS_ORCHESTRATOR_BASE and start the local orchestrator to execute for real.',
    })
  },
}

/**
 * Real runner. Streams newline-delimited JSON {log|status|result|error|costUsd}
 * from the local orchestrator's /run endpoint; any non-JSON line is shown as log.
 */
export function orchestratorRunner(base: string): Runner {
  return {
    kind: 'orchestrator',
    async submit(target, prompt, onUpdate) {
      onUpdate({ status: 'running', log: `▸ dispatched to ${target.label}` })
      const res = await fetch(`${base}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: target.id, path: target.path, prompt }),
      })
      if (!res.ok || !res.body) throw new Error(`orchestrator responded ${res.status}`)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          const t = line.trim()
          if (!t) continue
          try {
            onUpdate(JSON.parse(t) as RunUpdate)
          } catch {
            onUpdate({ log: t })
          }
        }
      }
    },
  }
}

/** The active runner: orchestrator when configured, otherwise the stub. */
export function pickRunner(): Runner {
  return env.orchestratorBase ? orchestratorRunner(env.orchestratorBase) : stubRunner
}
