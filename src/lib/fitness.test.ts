import { describe, it, expect } from 'vitest'
import {
  abilityLevel,
  abilityProgress,
  abilityStatus,
  addStep,
  createAbility,
  fitnessSummary,
  isOwned,
  isStepDone,
  logValue,
  moveStep,
  nearestWins,
  nextStep,
  parseAbilities,
  removeStep,
  rollupDisciplines,
  stepHistory,
  stepRatio,
  unitOf,
  updateAbility,
  updateStep,
  type NewAbilityInput,
} from './fitness'
import type { Ability } from '../types'

const seed = 1_000

/** A three-rung reps ability with nothing logged yet. */
function ladder(overrides: Partial<NewAbilityInput> = {}): Ability {
  return createAbility(
    {
      name: 'Pull-up',
      discipline: 'calisthenics',
      metric: 'reps',
      steps: [
        { name: 'Negatives', target: 5 },
        { name: 'Strict pull-up', target: 1 },
        { name: 'Strict pull-ups', target: 10 },
      ],
      ...overrides,
    },
    seed,
  )
}

describe('createAbility', () => {
  it('trims the name and defaults every current to 0 — nothing is assumed done', () => {
    const a = createAbility(
      { name: '  Handstand  ', discipline: 'calisthenics', metric: 'hold', steps: [{ name: 'Wall', target: 60 }] },
      seed,
    )
    expect(a.name).toBe('Handstand')
    expect(a.steps[0].current).toBe(0)
    expect(a.history).toEqual([])
    expect(abilityProgress(a)).toBe(0)
  })

  it('falls back to a placeholder name and drops blank optional fields', () => {
    const a = createAbility({ name: '   ', discipline: 'cardio', metric: 'time', goal: '  ', unit: ' ' }, seed)
    expect(a.name).toBe('Untitled ability')
    expect(a.goal).toBeUndefined()
    expect(a.unit).toBeUndefined()
    expect(a.steps).toEqual([])
  })
})

describe('stepRatio', () => {
  it('is the share of the target reached, clamped to 0..1', () => {
    expect(stepRatio({ id: 's', name: 'x', target: 10, current: 0 })).toBe(0)
    expect(stepRatio({ id: 's', name: 'x', target: 10, current: 5 })).toBe(0.5)
    expect(stepRatio({ id: 's', name: 'x', target: 10, current: 25 })).toBe(1)
  })

  it('treats a zero target as a can/can’t rung', () => {
    expect(stepRatio({ id: 's', name: 'x', target: 0, current: 0 })).toBe(0)
    expect(stepRatio({ id: 's', name: 'x', target: 0, current: 1 })).toBe(1)
  })

  it('measures lower-is-better rungs as the share of the gap closed from the baseline', () => {
    const step = { id: 's', name: '5K', target: 25, current: 30, start: 35 }
    expect(stepRatio(step, true)).toBe(0.5) // 35 → 30 of a 35 → 25 gap
    expect(stepRatio({ ...step, current: 24 }, true)).toBe(1) // beat the target
  })

  it('gives a lower-is-better rung no credit when there is no baseline to measure from', () => {
    expect(stepRatio({ id: 's', name: '5K', target: 25, current: 30 }, true)).toBe(0)
  })

  it('never reads an unlogged (0) lower-is-better rung as complete', () => {
    expect(stepRatio({ id: 's', name: '5K', target: 25, current: 0, start: 35 }, true)).toBe(0)
    expect(isStepDone({ id: 's', name: '5K', target: 25, current: 0, start: 35 }, true)).toBe(false)
  })
})

describe('ability progress', () => {
  it('is the mean share of the ladder owned, giving partial credit on every rung', () => {
    let a = ladder()
    a = logValue(a, a.steps[0].id, 5, '2026-07-01', seed) // rung 1 done
    a = logValue(a, a.steps[2].id, 5, '2026-07-01', seed) // rung 3 half
    // (1 + 0 + 0.5) / 3
    expect(abilityProgress(a)).toBe(50)
  })

  it('reports the level as rungs owned out of total', () => {
    let a = ladder()
    expect(abilityLevel(a)).toEqual({ done: 0, total: 3 })
    a = logValue(a, a.steps[0].id, 8, '2026-07-01', seed)
    expect(abilityLevel(a)).toEqual({ done: 1, total: 3 })
  })

  it('points at the first unowned rung as the next step', () => {
    let a = ladder()
    expect(nextStep(a)?.name).toBe('Negatives')
    a = logValue(a, a.steps[0].id, 5, '2026-07-01', seed)
    expect(nextStep(a)?.name).toBe('Strict pull-up')
  })

  it('is owned only when every rung is at target', () => {
    let a = ladder()
    expect(isOwned(a)).toBe(false)
    for (const s of a.steps) a = logValue(a, s.id, 99, '2026-07-01', seed)
    expect(isOwned(a)).toBe(true)
    expect(nextStep(a)).toBeNull()
    expect(abilityProgress(a)).toBe(100)
  })

  it('an ability with no rungs is 0% and not owned', () => {
    const a = createAbility({ name: 'Empty', discipline: 'strength', metric: 'reps' }, seed)
    expect(abilityProgress(a)).toBe(0)
    expect(isOwned(a)).toBe(false)
  })
})

describe('abilityStatus', () => {
  it('maps owned → live, started → progress, untouched → idle, paused → blocked', () => {
    let a = ladder()
    expect(abilityStatus(a)).toBe('idle')
    a = logValue(a, a.steps[0].id, 2, '2026-07-01', seed)
    expect(abilityStatus(a)).toBe('progress')
    let done = ladder()
    for (const s of done.steps) done = logValue(done, s.id, 99, '2026-07-01', seed)
    expect(abilityStatus(done)).toBe('live')
    expect(abilityStatus(updateAbility(a, { paused: true }, seed))).toBe('blocked')
  })
})

describe('logValue', () => {
  it('sets the rung’s current value and records history', () => {
    let a = ladder()
    a = logValue(a, a.steps[0].id, 3, '2026-07-01', 2_000)
    expect(a.steps[0].current).toBe(3)
    expect(a.history).toEqual([{ date: '2026-07-01', stepId: a.steps[0].id, value: 3 }])
    expect(a.updatedAt).toBe(2_000)
  })

  it('overwrites a same-day entry rather than duplicating it', () => {
    let a = ladder()
    const id = a.steps[0].id
    a = logValue(a, id, 3, '2026-07-01', seed)
    a = logValue(a, id, 4, '2026-07-01', seed)
    expect(stepHistory(a, id)).toHaveLength(1)
    expect(a.steps[0].current).toBe(4)
  })

  it('clamps negatives to 0 and ignores unknown rungs', () => {
    let a = ladder()
    a = logValue(a, a.steps[0].id, -5, '2026-07-01', seed)
    expect(a.steps[0].current).toBe(0)
    expect(logValue(a, 'nope', 5, '2026-07-01', seed)).toBe(a)
  })

  it('returns history oldest-first for the sparkline', () => {
    let a = ladder()
    const id = a.steps[0].id
    a = logValue(a, id, 2, '2026-07-05', seed)
    a = logValue(a, id, 4, '2026-07-01', seed)
    expect(stepHistory(a, id).map((h) => h.value)).toEqual([4, 2])
  })
})

describe('ladder editing', () => {
  it('appends a rung and ignores a blank name', () => {
    let a = ladder()
    a = addStep(a, { name: 'Weighted pull-up', target: 1 }, seed)
    expect(a.steps).toHaveLength(4)
    expect(addStep(a, { name: '   ', target: 1 }, seed)).toBe(a)
  })

  it('edits a rung but refuses to blank its name', () => {
    let a = ladder()
    const id = a.steps[0].id
    a = updateStep(a, id, { target: 8 }, seed)
    expect(a.steps[0].target).toBe(8)
    expect(updateStep(a, id, { name: '  ' }, seed)).toBe(a)
  })

  it('removing a rung drops its logged history too', () => {
    let a = ladder()
    const id = a.steps[0].id
    a = logValue(a, id, 3, '2026-07-01', seed)
    a = removeStep(a, id, seed)
    expect(a.steps).toHaveLength(2)
    expect(a.history).toEqual([])
  })

  it('reorders rungs and no-ops at the ends', () => {
    let a = ladder()
    const [first, second] = a.steps
    a = moveStep(a, second.id, -1, seed)
    expect(a.steps[0].id).toBe(second.id)
    expect(moveStep(a, second.id, -1, seed)).toBe(a) // already at the top
    expect(moveStep(a, first.id, 1, seed)).not.toBe(a)
    expect(moveStep(a, 'nope', 1, seed)).toBe(a)
  })
})

describe('unitOf', () => {
  it('prefers the ability’s override, else the metric default', () => {
    expect(unitOf({ metric: 'hold', unit: undefined })).toBe('s')
    expect(unitOf({ metric: 'distance', unit: 'cm' })).toBe('cm')
  })
})

describe('rollupDisciplines', () => {
  it('groups by discipline in rail order with counts, mean progress and worst status', () => {
    let pullup = ladder()
    for (const s of pullup.steps) pullup = logValue(pullup, s.id, 99, '2026-07-01', seed)
    const split = createAbility({ name: 'Front split', discipline: 'flexibility', metric: 'angle' }, seed)
    const kick = updateAbility(
      createAbility({ name: 'Head kick', discipline: 'taekwondo', metric: 'angle' }, seed),
      { paused: true },
      seed,
    )

    const rollup = rollupDisciplines([split, kick, pullup])
    expect(rollup.map((r) => r.discipline)).toEqual(['calisthenics', 'flexibility', 'taekwondo'])
    expect(rollup[0]).toMatchObject({ abilityCount: 1, ownedCount: 1, progress: 100, status: 'live' })
    expect(rollup[2].status).toBe('blocked')
  })

  it('omits disciplines with no abilities', () => {
    expect(rollupDisciplines([])).toEqual([])
    expect(rollupDisciplines([ladder()]).map((r) => r.discipline)).toEqual(['calisthenics'])
  })
})

describe('fitnessSummary + nearestWins', () => {
  it('counts owned / in-progress / paused and means the progress', () => {
    let owned = ladder()
    for (const s of owned.steps) owned = logValue(owned, s.id, 99, '2026-07-01', seed)
    let started = ladder({ name: 'Dip' })
    started = logValue(started, started.steps[0].id, 5, '2026-07-01', seed)
    const untouched = ladder({ name: 'Muscle-up' })
    const paused = updateAbility(ladder({ name: 'Pistol' }), { paused: true }, seed)

    const s = fitnessSummary([owned, started, untouched, paused])
    expect(s).toMatchObject({ total: 4, owned: 1, inProgress: 1, paused: 1 })
    expect(s.progress).toBe(Math.round((100 + 33 + 0 + 0) / 4))
  })

  it('ranks the closest unfinished abilities first and excludes owned/paused ones', () => {
    let close = ladder({ name: 'Close' })
    close = logValue(close, close.steps[0].id, 5, '2026-07-01', seed)
    close = logValue(close, close.steps[1].id, 1, '2026-07-01', seed)
    let far = ladder({ name: 'Far' })
    far = logValue(far, far.steps[0].id, 1, '2026-07-01', seed)
    let owned = ladder({ name: 'Owned' })
    for (const s of owned.steps) owned = logValue(owned, s.id, 99, '2026-07-01', seed)

    const wins = nearestWins([far, owned, close])
    expect(wins.map((a) => a.name)).toEqual(['Close', 'Far'])
  })
})

describe('parseAbilities', () => {
  it('returns [] for null / malformed JSON / non-arrays', () => {
    expect(parseAbilities(null)).toEqual([])
    expect(parseAbilities('{not json')).toEqual([])
    expect(parseAbilities('{"a":1}')).toEqual([])
  })

  it('drops entries with no name or an unknown discipline', () => {
    const raw = JSON.stringify([
      { name: 'Good', discipline: 'cardio', metric: 'time', steps: [] },
      { name: '', discipline: 'cardio' },
      { name: 'Bad discipline', discipline: 'quidditch' },
    ])
    expect(parseAbilities(raw).map((a) => a.name)).toEqual(['Good'])
  })

  it('round-trips a saved ability, keeping its ladder and history', () => {
    let a = ladder({ goal: 'Fifteen strict' })
    a = logValue(a, a.steps[0].id, 4, '2026-07-01', seed)
    const [back] = parseAbilities(JSON.stringify([a]))
    expect(back).toEqual(a)
    expect(abilityProgress(back)).toBe(abilityProgress(a))
  })

  it('falls back to a safe metric and drops malformed rungs', () => {
    const raw = JSON.stringify([
      {
        name: 'Odd',
        discipline: 'strength',
        metric: 'vibes',
        steps: [{ name: 'ok', target: 3, current: 1 }, { target: 5 }, null],
        history: [{ date: '2026-07-01', stepId: 'x', value: 1 }, { nope: true }],
      },
    ])
    const [a] = parseAbilities(raw)
    expect(a.metric).toBe('reps')
    expect(a.steps).toHaveLength(1)
    expect(a.history).toHaveLength(1)
  })
})
