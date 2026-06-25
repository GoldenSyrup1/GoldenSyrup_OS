import { describe, it, expect } from 'vitest'
import { groupByStage, JOB_STAGES } from './jobs'
import type { JobApplication } from '../types'

const jobs: JobApplication[] = [
  { id: '1', company: 'A', role: 'r', stage: 'applied', updated: '2026-06-01' },
  { id: '2', company: 'B', role: 'r', stage: 'applied', updated: '2026-06-02' },
  { id: '3', company: 'C', role: 'r', stage: 'offer', updated: '2026-06-03' },
]

describe('groupByStage', () => {
  it('returns every stage as a key, even empty ones', () => {
    const cols = groupByStage(jobs)
    expect(Object.keys(cols).sort()).toEqual([...JOB_STAGES].sort())
    expect(cols.researching).toEqual([])
  })
  it('buckets applications into the right column', () => {
    const cols = groupByStage(jobs)
    expect(cols.applied).toHaveLength(2)
    expect(cols.offer).toHaveLength(1)
  })
})
