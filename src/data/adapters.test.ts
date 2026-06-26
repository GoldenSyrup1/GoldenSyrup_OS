import { describe, it, expect } from 'vitest'
import {
  applyPillarSignals,
  applyProjectSignals,
  deriveWeportSignal,
  normalizeMemories,
  parseEthPrice,
} from './adapters'
import type { Pillar, Project } from '../types'

const pillars: Pillar[] = [
  { id: 'finance', name: 'Finance', status: 'idle', progress: 10, nextAction: 'x' },
  { id: 'law', name: 'Law', status: 'idle', progress: 5, nextAction: 'y' },
]

const projects: Project[] = [
  { id: 'weport', name: 'WEPort', status: 'live', progress: 95, summary: 'seed', nextAction: 'a' },
  { id: 'stall-in', name: 'Stall-In', status: 'live', progress: 80, summary: 'seed', nextAction: 'b' },
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

describe('applyProjectSignals', () => {
  it('overlays matched signals by id and clamps progress', () => {
    const out = applyProjectSignals(projects, [
      { id: 'weport', status: 'blocked', progress: 150, summary: 'down' },
    ])
    expect(out[0]).toMatchObject({ status: 'blocked', progress: 100, summary: 'down' })
    expect(out[0].nextAction).toBe('a') // untouched fields preserved
    expect(out[1]).toEqual(projects[1]) // unmatched project untouched
  })
  it('ignores signals with no matching project', () => {
    expect(applyProjectSignals(projects, [{ id: 'nope', status: 'idle' }])).toEqual(projects)
  })
})

describe('deriveWeportSignal', () => {
  it('reports live when reachable and blocked when not', () => {
    expect(deriveWeportSignal(true)).toMatchObject({ id: 'weport', status: 'live' })
    expect(deriveWeportSignal(false)).toMatchObject({ id: 'weport', status: 'blocked' })
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
