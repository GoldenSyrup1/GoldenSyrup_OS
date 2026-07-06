import type { Run, RunStatus } from '../types'

export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  done: 'Done',
  failed: 'Failed',
}

export const RUN_STATUS_COLOR: Record<RunStatus, string> = {
  queued: '#8b949e',
  running: '#d29922',
  done: '#3fb950',
  failed: '#f85149',
}

/** A run still occupies the queue until it reaches a terminal state. */
export function isActive(status: RunStatus): boolean {
  return status === 'queued' || status === 'running'
}

/** Newest-first copy for display. Pure (does not mutate input). */
export function sortByNewest(runs: Run[]): Run[] {
  return [...runs].sort((a, b) => b.createdAt - a.createdAt)
}

/** Total USD reported across all runs. Pure. */
export function totalSpend(runs: Run[]): number {
  return runs.reduce((sum, r) => sum + (r.costUsd ?? 0), 0)
}

export interface BudgetState {
  spent: number
  cap: number
  /** Fraction of cap used, 0..1+ (0 when the cap is untracked). */
  fraction: number
  level: 'ok' | 'warn' | 'over'
}

/**
 * Budget / "credits" state used for advance-warning. `warnAt` is the fraction
 * (0..1) at which we flag a low balance before it runs out (default 0.8). A
 * cap of 0 or less means untracked ⇒ always 'ok'.
 */
export function budgetState(spent: number, cap: number, warnAt = 0.8): BudgetState {
  if (cap <= 0) return { spent, cap, fraction: 0, level: 'ok' }
  const fraction = spent / cap
  const level = fraction >= 1 ? 'over' : fraction >= warnAt ? 'warn' : 'ok'
  return { spent, cap, fraction, level }
}
