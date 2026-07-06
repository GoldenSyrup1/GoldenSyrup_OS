import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CommandNode, Run } from '../types'
import { pickRunner } from '../lib/runner'
import { budgetState, totalSpend, type BudgetState } from '../lib/runs'

const LS_RUNS = 'gsos.runs.v1'
const LS_CAP = 'gsos.budgetCap.v1'
const DEFAULT_CAP_USD = 5

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function loadRuns(): Run[] {
  if (typeof localStorage === 'undefined') return []
  return safeParse<Run[]>(localStorage.getItem(LS_RUNS), [])
}

function loadCap(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_CAP_USD
  const n = Number(localStorage.getItem(LS_CAP))
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CAP_USD
}

/** Best-effort browser notification; silently no-ops in tests / when denied. */
function notify(title: string, body: string): void {
  if (typeof Notification === 'undefined') return
  try {
    if (Notification.permission === 'granted') new Notification(title, { body })
  } catch {
    /* ignore */
  }
}

export interface CommandConsole {
  runs: Run[]
  submit: (target: CommandNode, prompt: string) => void
  clearRun: (id: string) => void
  cap: number
  setCap: (usd: number) => void
  budget: BudgetState
  runnerKind: string
}

/**
 * Owns the run queue: dispatches prompts through the active runner, streams
 * updates into state, persists to localStorage, and tracks budget so we can
 * warn *before* the session cap is hit and notify when it is exceeded.
 */
export function useCommandConsole(): CommandConsole {
  const [runs, setRuns] = useState<Run[]>(loadRuns)
  const [cap, setCapState] = useState<number>(loadCap)
  const runner = useRef(pickRunner())
  const seq = useRef(0)
  const warnedRef = useRef(false)

  // Persist runs (trim to the most recent 100 to bound storage).
  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(LS_RUNS, JSON.stringify(runs.slice(-100)))
  }, [runs])

  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(LS_CAP, String(cap))
  }, [cap])

  // Advance budget warning: fire once when we cross into warn/over.
  const budget = useMemo(() => budgetState(totalSpend(runs), cap), [runs, cap])
  useEffect(() => {
    if (budget.level === 'ok') {
      warnedRef.current = false
      return
    }
    if (warnedRef.current) return
    warnedRef.current = true
    if (budget.level === 'over') {
      notify('GoldenSyrup OS — out of budget', `Session spend $${budget.spent.toFixed(2)} exceeded the $${cap.toFixed(2)} cap.`)
    } else {
      notify('GoldenSyrup OS — budget low', `Session spend $${budget.spent.toFixed(2)} of $${cap.toFixed(2)} (${Math.round(budget.fraction * 100)}%).`)
    }
  }, [budget, cap])

  const patch = useCallback((id: string, fn: (r: Run) => Run) => {
    setRuns((prev) => prev.map((r) => (r.id === id ? fn(r) : r)))
  }, [])

  const submit = useCallback(
    (target: CommandNode, prompt: string) => {
      const text = prompt.trim()
      if (!text) return
      const id = `run-${Date.now()}-${seq.current++}`
      const fresh: Run = {
        id,
        targetId: target.id,
        targetLabel: target.label,
        prompt: text,
        status: 'queued',
        createdAt: Date.now(),
        log: [],
      }
      setRuns((prev) => [...prev, fresh])

      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {})
      }

      runner.current
        .submit(target, text, (u) => {
          patch(id, (r) => ({
            ...r,
            status: u.status ?? r.status,
            log: u.log ? [...r.log, u.log] : r.log,
            result: u.result ?? r.result,
            error: u.error ?? r.error,
            costUsd: u.costUsd ?? r.costUsd,
          }))
        })
        .then(() => {
          patch(id, (r) => (r.status === 'queued' || r.status === 'running' ? { ...r, status: 'done' } : r))
          notify(`✅ ${target.label} — done`, text.slice(0, 80))
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err)
          patch(id, (r) => ({ ...r, status: 'failed', error: msg, log: [...r.log, `✗ ${msg}`] }))
          notify(`⚠️ ${target.label} — failed`, msg.slice(0, 80))
        })
    },
    [patch],
  )

  const clearRun = useCallback((id: string) => setRuns((prev) => prev.filter((r) => r.id !== id)), [])
  const setCap = useCallback((usd: number) => setCapState(Number.isFinite(usd) && usd >= 0 ? usd : 0), [])

  return { runs, submit, clearRun, cap, setCap, budget, runnerKind: runner.current.kind }
}
