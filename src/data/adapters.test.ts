import { describe, it, expect } from 'vitest'
import { applyPillarSignals, normalizeMemories, parseEthPrice } from './adapters'
import type { Pillar } from '../types'

const pillars: Pillar[] = [
  { id: 'finance', name: 'Finance', status: 'idle', progress: 10, nextAction: 'x' },
  { id: 'law', name: 'Law', status: 'idle', progress: 5, nextAction: 'y' },
]

describe('applyPillarSignals', () => {
  it('overlays matched signals by id', () => {
    const out = applyPillarSignals(pillars, [
      { pillar: 'finance', progress: 80, status: 'live', signal: 'RBA live' },
    ])
    expect(out[0]).toMatchObject({ progress: 80, status: 'live', signal: 'RBA live' })
    expect(out[1].progress).toBe(5) // untouched
  })
  it('matches by display name case-insensitively and clamps progress', () => {
    const out = applyPillarSignals(pillars, [{ pillar: 'LAW', progress: 250 }])
    expect(out[1].progress).toBe(100)
  })
  it('ignores signals with no matching pillar', () => {
    const out = applyPillarSignals(pillars, [{ pillar: 'unknown', progress: 99 }])
    expect(out).toEqual(pillars)
  })
})

describe('normalizeMemories', () => {
  it('handles a bare array and a { memories } envelope', () => {
    const a = normalizeMemories([{ content: 'hi', source: 'cc', tags: ['t'], created_at: '2026-01-01' }])
    const b = normalizeMemories({ memories: [{ content: 'yo' }] })
    expect(a).toHaveLength(1)
    expect(b[0]).toMatchObject({ content: 'yo', source: 'unknown', tags: [] })
  })
  it('drops malformed entries and non-string tags', () => {
    const out = normalizeMemories([null, 5, { content: '' }, { content: 'ok', tags: ['a', 2, null] }])
    expect(out).toHaveLength(1)
    expect(out[0].tags).toEqual(['a'])
  })
})

describe('parseEthPrice', () => {
  it('extracts a finite usd price', () => {
    expect(parseEthPrice({ ethereum: { usd: 2500 } })).toBe(2500)
  })
  it('returns null for missing or non-finite values', () => {
    expect(parseEthPrice({})).toBeNull()
    expect(parseEthPrice({ ethereum: { usd: 'oops' } })).toBeNull()
    expect(parseEthPrice(null)).toBeNull()
  })
})
