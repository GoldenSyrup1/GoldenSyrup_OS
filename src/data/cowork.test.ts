import { describe, it, expect } from 'vitest'
import { normalizeCoworkState, aggregateByCategory } from './cowork'
import type { CoworkTask } from '../types'

describe('normalizeCoworkState', () => {
  it('parses a well-formed payload and clamps progress', () => {
    const state = normalizeCoworkState({
      generatedAt: '2026-07-09T00:00:00Z',
      tasks: [{ id: 't1', title: 'A', category: 'X', status: 'progress', progress: 150 }],
    })
    expect(state.generatedAt).toBe('2026-07-09T00:00:00Z')
    expect(state.tasks).toHaveLength(1)
    expect(state.tasks[0].progress).toBe(100)
  })

  it('drops entries without a title and defaults missing fields', () => {
    const state = normalizeCoworkState({ tasks: [{ id: 'a' }, { title: 'Real' }] })
    expect(state.tasks).toHaveLength(1)
    const t = state.tasks[0]
    expect(t.category).toBe('Uncategorised')
    expect(t.status).toBe('idle')
    expect(t.progress).toBe(0)
    expect(t.id).toBe('task-1') // index-based fallback id
  })

  it('coerces unknown status to idle and tolerates junk input', () => {
    expect(normalizeCoworkState(null).tasks).toEqual([])
    expect(normalizeCoworkState({ tasks: 'nope' }).tasks).toEqual([])
    const s = normalizeCoworkState({ tasks: [{ title: 'B', status: 'wat' }] })
    expect(s.tasks[0].status).toBe('idle')
  })

  it('accepts a bare array of tasks', () => {
    const s = normalizeCoworkState([{ title: 'C', category: 'Y' }])
    expect(s.tasks[0].category).toBe('Y')
  })
})

describe('aggregateByCategory', () => {
  const tasks: CoworkTask[] = [
    { id: '1', title: 'a', category: 'WEPort', status: 'progress', progress: 60 },
    { id: '2', title: 'b', category: 'WEPort', status: 'blocked', progress: 20 },
    { id: '3', title: 'c', category: 'Intel', status: 'live', progress: 100 },
  ]

  it('rolls up count, weighted progress, and worst-case status', () => {
    const cats = aggregateByCategory(tasks)
    expect(cats.map((c) => c.name)).toEqual(['WEPort', 'Intel']) // first-appearance order
    const weport = cats.find((c) => c.name === 'WEPort')!
    expect(weport.taskCount).toBe(2)
    expect(weport.progress).toBe(40) // (60 + 20) / 2
    expect(weport.status).toBe('blocked') // worst-case wins
    expect(cats.find((c) => c.name === 'Intel')!.status).toBe('live')
  })

  it('returns [] for no tasks', () => {
    expect(aggregateByCategory([])).toEqual([])
  })
})
