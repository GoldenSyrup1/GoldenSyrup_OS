import { describe, it, expect } from 'vitest'
import {
  statusColor,
  statusLabel,
  clampProgress,
  aggregateProgress,
  statusBreakdown,
  byAttention,
} from './util'

describe('clampProgress', () => {
  it('clamps below 0 and above 100', () => {
    expect(clampProgress(-20)).toBe(0)
    expect(clampProgress(150)).toBe(100)
  })
  it('rounds fractional values', () => {
    expect(clampProgress(42.6)).toBe(43)
  })
  it('treats NaN as 0', () => {
    expect(clampProgress(Number.NaN)).toBe(0)
  })
})

describe('aggregateProgress', () => {
  it('returns 0 for empty list', () => {
    expect(aggregateProgress([])).toBe(0)
  })
  it('averages and clamps members', () => {
    expect(aggregateProgress([{ progress: 50 }, { progress: 100 }])).toBe(75)
    expect(aggregateProgress([{ progress: 200 }, { progress: 0 }])).toBe(50)
  })
})

describe('statusColor / statusLabel', () => {
  it('maps every status to a distinct color', () => {
    const colors = new Set(
      (['live', 'progress', 'blocked', 'idle'] as const).map(statusColor),
    )
    expect(colors.size).toBe(4)
  })
  it('labels are human-readable', () => {
    expect(statusLabel('progress')).toBe('In progress')
  })
})

describe('statusBreakdown', () => {
  it('counts each status and includes zeros', () => {
    const b = statusBreakdown([
      { status: 'live' },
      { status: 'live' },
      { status: 'blocked' },
    ])
    expect(b).toEqual({ live: 2, progress: 0, blocked: 1, idle: 0 })
  })
})

describe('byAttention', () => {
  it('orders blocked → progress → idle → live', () => {
    const ordered = byAttention([
      { status: 'live' },
      { status: 'idle' },
      { status: 'blocked' },
      { status: 'progress' },
    ])
    expect(ordered.map((x) => x.status)).toEqual(['blocked', 'progress', 'idle', 'live'])
  })
  it('does not mutate input', () => {
    const input = [{ status: 'live' as const }, { status: 'blocked' as const }]
    byAttention(input)
    expect(input[0].status).toBe('live')
  })
})
