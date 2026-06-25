import type { Status, Pillar, Project } from '../types'

/** Tailwind text/stroke color token for a status. Pure — unit tested. */
export function statusColor(status: Status): string {
  switch (status) {
    case 'live':
      return '#3fb950'
    case 'progress':
      return '#d29922'
    case 'blocked':
      return '#f85149'
    case 'idle':
      return '#8b949e'
  }
}

export function statusLabel(status: Status): string {
  return { live: 'Live', progress: 'In progress', blocked: 'Blocked', idle: 'Idle' }[status]
}

/** Clamp an arbitrary number into a valid 0..100 progress value. */
export function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

/** Weighted-equal mean of progress across items; 0 for empty list. */
export function aggregateProgress(items: Array<{ progress: number }>): number {
  if (items.length === 0) return 0
  const sum = items.reduce((acc, i) => acc + clampProgress(i.progress), 0)
  return Math.round(sum / items.length)
}

/** Count items by status, returning a complete record (zeros included). */
export function statusBreakdown(
  items: Array<{ status: Status }>,
): Record<Status, number> {
  const base: Record<Status, number> = { live: 0, progress: 0, blocked: 0, idle: 0 }
  for (const i of items) base[i.status] += 1
  return base
}

/** Items needing attention first: blocked, then in-progress, then idle. */
export function byAttention<T extends { status: Status }>(items: T[]): T[] {
  const rank: Record<Status, number> = { blocked: 0, progress: 1, idle: 2, live: 3 }
  return [...items].sort((a, b) => rank[a.status] - rank[b.status])
}

export function isPillar(x: Pillar | Project): x is Pillar {
  return !('summary' in x)
}
