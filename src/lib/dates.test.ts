import { describe, it, expect } from 'vitest'
import { daysBetween, formatRelative, isPast, sortByDate } from './dates'

describe('date helpers', () => {
  it('counts whole days between two ISO dates', () => {
    expect(daysBetween('2026-06-25', '2026-06-30')).toBe(5)
    expect(daysBetween('2026-06-30', '2026-06-25')).toBe(-5)
  })

  it('returns null for unparseable input', () => {
    expect(daysBetween('not-a-date', '2026-06-30')).toBeNull()
  })

  it('formats relative labels around now', () => {
    const now = '2026-06-25'
    expect(formatRelative('2026-06-25', now)).toBe('today')
    expect(formatRelative('2026-06-26', now)).toBe('tomorrow')
    expect(formatRelative('2026-06-24', now)).toBe('yesterday')
    expect(formatRelative('2026-06-30', now)).toBe('in 5d')
    expect(formatRelative('2026-06-20', now)).toBe('5d ago')
  })

  it('detects past dates', () => {
    expect(isPast('2026-06-24', '2026-06-25')).toBe(true)
    expect(isPast('2026-06-26', '2026-06-25')).toBe(false)
    expect(isPast('2026-06-25', '2026-06-25')).toBe(false)
  })

  it('sorts by date ascending without mutating input', () => {
    const input = [{ date: '2026-06-30' }, { date: '2026-06-01' }, { date: '2026-06-15' }]
    const out = sortByDate(input)
    expect(out.map((i) => i.date)).toEqual(['2026-06-01', '2026-06-15', '2026-06-30'])
    expect(input[0].date).toBe('2026-06-30') // original untouched
  })
})
