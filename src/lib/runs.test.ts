import { describe, it, expect } from 'vitest'
import { isActive, sortByNewest, totalSpend, budgetState } from './runs'
import type { Run } from '../types'

function run(partial: Partial<Run>): Run {
  return {
    id: 'r',
    targetId: 't',
    targetLabel: 'T',
    prompt: 'p',
    status: 'done',
    createdAt: 0,
    log: [],
    ...partial,
  }
}

describe('isActive', () => {
  it('is true only for non-terminal states', () => {
    expect(isActive('queued')).toBe(true)
    expect(isActive('running')).toBe(true)
    expect(isActive('done')).toBe(false)
    expect(isActive('failed')).toBe(false)
  })
})

describe('sortByNewest', () => {
  it('orders newest first without mutating the input', () => {
    const input = [run({ id: 'a', createdAt: 1 }), run({ id: 'b', createdAt: 3 }), run({ id: 'c', createdAt: 2 })]
    expect(sortByNewest(input).map((r) => r.id)).toEqual(['b', 'c', 'a'])
    expect(input.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('totalSpend', () => {
  it('sums costUsd treating missing cost as 0', () => {
    expect(totalSpend([run({ costUsd: 0.12 }), run({}), run({ costUsd: 0.38 })])).toBeCloseTo(0.5)
  })
})

describe('budgetState', () => {
  it('is always ok when the cap is untracked', () => {
    expect(budgetState(999, 0).level).toBe('ok')
  })
  it('warns in advance at the threshold and flags over at the cap', () => {
    expect(budgetState(4, 10).level).toBe('ok') // 40%
    expect(budgetState(8, 10).level).toBe('warn') // 80% default warnAt
    expect(budgetState(10, 10).level).toBe('over') // 100%
    expect(budgetState(12, 10).fraction).toBeCloseTo(1.2)
  })
  it('honours a custom warnAt', () => {
    expect(budgetState(5, 10, 0.5).level).toBe('warn')
    expect(budgetState(4, 10, 0.5).level).toBe('ok')
  })
})
