// Pure date helpers for timelines. `now` is always passed in so these stay
// deterministic and unit-testable.

/** Whole days from `fromISO` to `toISO`; null if either is unparseable. */
export function daysBetween(fromISO: string, toISO: string): number | null {
  const a = Date.parse(fromISO)
  const b = Date.parse(toISO)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86_400_000)
}

/** Human-relative label for `targetISO` vs `nowISO`, e.g. "in 5d" / "3d ago". */
export function formatRelative(targetISO: string, nowISO: string): string {
  const d = daysBetween(nowISO, targetISO)
  if (d === null) return ''
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  if (d === -1) return 'yesterday'
  return d > 0 ? `in ${d}d` : `${-d}d ago`
}

/** True if `targetISO` is strictly before `nowISO` (date-only comparison). */
export function isPast(targetISO: string, nowISO: string): boolean {
  const d = daysBetween(nowISO, targetISO)
  return d !== null && d < 0
}

/** Items sorted by their ISO `date`, ascending (soonest first). Stable, pure. */
export function sortByDate<T extends { date: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const x = Date.parse(a.date)
    const y = Date.parse(b.date)
    return (Number.isNaN(x) ? 0 : x) - (Number.isNaN(y) ? 0 : y)
  })
}
