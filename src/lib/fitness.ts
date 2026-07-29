// Pure logic for ability-first fitness tracking. Everything here is
// framework-agnostic and unit-tested; React state and persistence sit at the edges.
//
// The model: you don't track workouts, you track *abilities*. An ability owns an
// ordered progression ladder, each rung has a target and a hand-entered current
// best, and progress is the share of that ladder you actually own.

import type {
  Ability,
  AbilityMetric,
  Discipline,
  DisciplineRollup,
  ProgressionStep,
  Status,
} from '../types'

/** Visual + descriptive identity per discipline — used by the rail and the forms. */
export const DISCIPLINES: Record<Discipline, { label: string; icon: string; color: string; blurb: string }> = {
  calisthenics: { label: 'Calisthenics', icon: '🤸', color: '#e0a020', blurb: 'Bodyweight skill + strength' },
  plyometrics: { label: 'Plyometrics', icon: '⚡', color: '#f5c451', blurb: 'Explosiveness and spring' },
  isometrics: { label: 'Isometrics', icon: '🧱', color: '#a371f7', blurb: 'Holds and static tension' },
  cardio: { label: 'Cardio', icon: '🫁', color: '#58a6ff', blurb: 'Engine and endurance' },
  flexibility: { label: 'Flexibility', icon: '🧘', color: '#3fb950', blurb: 'Range of motion' },
  taekwondo: { label: 'Taekwondo', icon: '🥋', color: '#f85149', blurb: 'Technique, forms, belt path' },
  strength: { label: 'Strength', icon: '🏋️', color: '#d29922', blurb: 'Loaded muscle work' },
}

/** Stable rail order — broad movement first, sport-specific last. */
export const DISCIPLINE_ORDER: Discipline[] = [
  'calisthenics',
  'plyometrics',
  'isometrics',
  'strength',
  'cardio',
  'flexibility',
  'taekwondo',
]

/** Default unit + how to describe a target, per metric. */
export const METRICS: Record<AbilityMetric, { label: string; unit: string }> = {
  reps: { label: 'Reps', unit: 'reps' },
  hold: { label: 'Hold', unit: 's' },
  distance: { label: 'Distance', unit: 'km' },
  time: { label: 'Time', unit: 'min' },
  angle: { label: 'Angle', unit: '°' },
  load: { label: 'Load', unit: 'kg' },
  binary: { label: 'Can / can’t', unit: '' },
}

/** Unit label for an ability — its override, else the metric default. */
export function unitOf(ability: Pick<Ability, 'metric' | 'unit'>): string {
  return ability.unit ?? METRICS[ability.metric].unit
}

let seq = 0
/** Monotonic id suffix. Deterministic within a session, unique enough for the board. */
function nextId(prefix: string, seed: number): string {
  return `${prefix}-${seed}-${seq++}`
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

// ---- progress maths --------------------------------------------------------

/**
 * How much of one rung is owned, 0..1.
 *
 * Higher-is-better rungs are simply `current / target`. Lower-is-better rungs
 * (a 5k time) need a baseline to measure against: `start` is where you began, so
 * credit is the share of the gap closed. Without a baseline an unmet rung scores
 * 0 rather than inventing a starting point.
 */
export function stepRatio(step: ProgressionStep, lowerIsBetter = false): number {
  const { current, target } = step
  if (!Number.isFinite(current) || current <= 0) return 0
  if (lowerIsBetter) {
    if (current <= target) return 1
    const start = step.start
    if (start === undefined || !Number.isFinite(start) || start <= target) return 0
    return clamp01((start - current) / (start - target))
  }
  if (target <= 0) return 1 // "can you do it at all" rungs: any non-zero entry owns it
  return clamp01(current / target)
}

/** True when a rung is fully owned. */
export function isStepDone(step: ProgressionStep, lowerIsBetter = false): boolean {
  return stepRatio(step, lowerIsBetter) >= 1
}

/**
 * Ability progress 0..100 — the mean share of its rungs owned. Partial credit on
 * every rung (not just the current one) so out-of-order manual entries still count.
 */
export function abilityProgress(ability: Ability): number {
  if (ability.steps.length === 0) return 0
  const sum = ability.steps.reduce((acc, s) => acc + stepRatio(s, ability.lowerIsBetter), 0)
  return Math.round((sum / ability.steps.length) * 100)
}

/** Rungs owned vs total — the "Level 3 / 7" readout. */
export function abilityLevel(ability: Ability): { done: number; total: number } {
  const done = ability.steps.filter((s) => isStepDone(s, ability.lowerIsBetter)).length
  return { done, total: ability.steps.length }
}

/** The rung to work on next: the first one not yet owned. Null when the ability is owned. */
export function nextStep(ability: Ability): ProgressionStep | null {
  return ability.steps.find((s) => !isStepDone(s, ability.lowerIsBetter)) ?? null
}

/** True when every rung is owned (and there is at least one rung). */
export function isOwned(ability: Ability): boolean {
  return ability.steps.length > 0 && nextStep(ability) === null
}

/** Ability → dashboard status: owned is live, parked is blocked, untouched is idle. */
export function abilityStatus(ability: Ability): Status {
  if (ability.paused) return 'blocked'
  if (isOwned(ability)) return 'live'
  return abilityProgress(ability) > 0 ? 'progress' : 'idle'
}

const STATUS_RANK: Record<Status, number> = { blocked: 3, progress: 2, idle: 1, live: 0 }

/**
 * Roll abilities up per discipline for the left rail: count, mean progress, and
 * the worst-case status. Only disciplines that actually have abilities appear,
 * ordered by `DISCIPLINE_ORDER` so the rail is stable across edits.
 */
export function rollupDisciplines(abilities: Ability[]): DisciplineRollup[] {
  return DISCIPLINE_ORDER.map((discipline) => {
    const group = abilities.filter((a) => a.discipline === discipline)
    if (group.length === 0) return null
    const progress = Math.round(group.reduce((s, a) => s + abilityProgress(a), 0) / group.length)
    const status = group.reduce<Status>(
      (worst, a) => (STATUS_RANK[abilityStatus(a)] > STATUS_RANK[worst] ? abilityStatus(a) : worst),
      'live',
    )
    return {
      discipline,
      abilityCount: group.length,
      ownedCount: group.filter(isOwned).length,
      progress,
      status,
    }
  }).filter((r): r is DisciplineRollup => r !== null)
}

/** Whole-board summary for the header strip. */
export function fitnessSummary(abilities: Ability[]): {
  total: number
  owned: number
  inProgress: number
  paused: number
  progress: number
} {
  const owned = abilities.filter(isOwned).length
  const paused = abilities.filter((a) => a.paused).length
  const progress =
    abilities.length === 0
      ? 0
      : Math.round(abilities.reduce((s, a) => s + abilityProgress(a), 0) / abilities.length)
  return {
    total: abilities.length,
    owned,
    inProgress: abilities.filter((a) => !a.paused && !isOwned(a) && abilityProgress(a) > 0).length,
    paused,
    progress,
  }
}

/** Abilities closest to being unlocked first — what to push on this week. */
export function nearestWins(abilities: Ability[], limit = 3): Ability[] {
  return abilities
    .filter((a) => !a.paused && !isOwned(a) && abilityProgress(a) > 0)
    .sort((a, b) => abilityProgress(b) - abilityProgress(a))
    .slice(0, limit)
}

// ---- ability + step ops (pure; never mutate) --------------------------------

export interface NewAbilityInput {
  name: string
  discipline: Discipline
  metric: AbilityMetric
  unit?: string
  goal?: string
  lowerIsBetter?: boolean
  /** Optional starting ladder — `current` defaults to 0 (nothing is assumed done). */
  steps?: Array<{ name: string; target: number; current?: number; start?: number; note?: string }>
}

/** A fresh ability. `seed` (e.g. a timestamp) makes ids stable/testable. */
export function createAbility(input: NewAbilityInput, seed: number): Ability {
  const name = input.name.trim() || 'Untitled ability'
  return {
    id: nextId('ability', seed),
    name,
    discipline: input.discipline,
    metric: input.metric,
    unit: input.unit?.trim() || undefined,
    goal: input.goal?.trim() || undefined,
    lowerIsBetter: input.lowerIsBetter || undefined,
    steps: (input.steps ?? []).map((s) => ({
      id: nextId('step', seed),
      name: s.name.trim() || 'Untitled step',
      target: Number.isFinite(s.target) ? s.target : 0,
      current: Number.isFinite(s.current ?? 0) ? s.current ?? 0 : 0,
      start: s.start,
      note: s.note?.trim() || undefined,
    })),
    history: [],
    createdAt: seed,
    updatedAt: seed,
  }
}

function touch(ability: Ability, seed: number): Ability {
  return { ...ability, updatedAt: seed }
}

/** Edit an ability's own fields (not its ladder). Blank names are ignored. */
export function updateAbility(
  ability: Ability,
  patch: Partial<Pick<Ability, 'name' | 'discipline' | 'metric' | 'unit' | 'goal' | 'lowerIsBetter' | 'paused'>>,
  seed: number,
): Ability {
  const next = { ...ability, ...patch }
  if (patch.name !== undefined) {
    const clean = patch.name.trim()
    if (!clean) return ability
    next.name = clean
  }
  return touch(next, seed)
}

/** Append a rung to the ladder. */
export function addStep(
  ability: Ability,
  step: { name: string; target: number; current?: number; start?: number; note?: string },
  seed: number,
): Ability {
  const clean = step.name.trim()
  if (!clean) return ability
  const added: ProgressionStep = {
    id: nextId('step', seed),
    name: clean,
    target: Number.isFinite(step.target) ? step.target : 0,
    current: Number.isFinite(step.current ?? 0) ? step.current ?? 0 : 0,
    start: step.start,
    note: step.note?.trim() || undefined,
  }
  return touch({ ...ability, steps: [...ability.steps, added] }, seed)
}

/** Edit a rung's definition (name / target / baseline / note). */
export function updateStep(
  ability: Ability,
  stepId: string,
  patch: Partial<Omit<ProgressionStep, 'id'>>,
  seed: number,
): Ability {
  if (patch.name !== undefined && !patch.name.trim()) return ability
  return touch(
    {
      ...ability,
      steps: ability.steps.map((s) =>
        s.id === stepId ? { ...s, ...patch, name: patch.name?.trim() ?? s.name } : s,
      ),
    },
    seed,
  )
}

/** Remove a rung and any logged entries against it. */
export function removeStep(ability: Ability, stepId: string, seed: number): Ability {
  return touch(
    {
      ...ability,
      steps: ability.steps.filter((s) => s.id !== stepId),
      history: ability.history.filter((h) => h.stepId !== stepId),
    },
    seed,
  )
}

/** Move a rung up or down the ladder. Out-of-range moves are no-ops. */
export function moveStep(ability: Ability, stepId: string, dir: -1 | 1, seed: number): Ability {
  const i = ability.steps.findIndex((s) => s.id === stepId)
  const j = i + dir
  if (i === -1 || j < 0 || j >= ability.steps.length) return ability
  const steps = [...ability.steps]
  ;[steps[i], steps[j]] = [steps[j], steps[i]]
  return touch({ ...ability, steps }, seed)
}

/**
 * The core manual entry: record what you can currently do on a rung. Sets the
 * rung's `current` and appends to history (one entry per rung per day — a repeat
 * on the same date overwrites, so a session's best is what's kept).
 */
export function logValue(
  ability: Ability,
  stepId: string,
  value: number,
  date: string,
  seed: number,
): Ability {
  if (!ability.steps.some((s) => s.id === stepId)) return ability
  const clean = Number.isFinite(value) ? Math.max(0, value) : 0
  const history = ability.history.filter((h) => !(h.stepId === stepId && h.date === date))
  return touch(
    {
      ...ability,
      steps: ability.steps.map((s) => (s.id === stepId ? { ...s, current: clean } : s)),
      history: [...history, { date, stepId, value: clean }],
    },
    seed,
  )
}

/** Logged entries for one rung, oldest first — the sparkline source. */
export function stepHistory(ability: Ability, stepId: string): Ability['history'] {
  return ability.history.filter((h) => h.stepId === stepId).sort((a, b) => a.date.localeCompare(b.date))
}

// ---- persistence -----------------------------------------------------------

const LS_KEY = 'gsos.fitness.v1'

const DISCIPLINE_SET = new Set<string>(DISCIPLINE_ORDER)
const METRIC_SET = new Set<string>(Object.keys(METRICS))

function parseStep(raw: unknown, i: number): ProgressionStep | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  const name = typeof o.name === 'string' ? o.name : ''
  if (!name) return null
  return {
    id: typeof o.id === 'string' ? o.id : `step-restored-${i}`,
    name,
    target: typeof o.target === 'number' && Number.isFinite(o.target) ? o.target : 0,
    current: typeof o.current === 'number' && Number.isFinite(o.current) ? o.current : 0,
    start: typeof o.start === 'number' && Number.isFinite(o.start) ? o.start : undefined,
    note: typeof o.note === 'string' ? o.note : undefined,
  }
}

/** Defensively parse the persisted ability list. Pure — malformed entries are dropped. */
export function parseAbilities(raw: string | null): Ability[] {
  if (!raw) return []
  let arr: unknown
  try {
    arr = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(arr)) return []
  return arr
    .map((item, i): Ability | null => {
      if (typeof item !== 'object' || item === null) return null
      const o = item as Record<string, unknown>
      const name = typeof o.name === 'string' ? o.name : ''
      if (!name) return null
      if (typeof o.discipline !== 'string' || !DISCIPLINE_SET.has(o.discipline)) return null
      const metric = typeof o.metric === 'string' && METRIC_SET.has(o.metric) ? o.metric : 'reps'
      const steps = Array.isArray(o.steps)
        ? o.steps.map(parseStep).filter((s): s is ProgressionStep => s !== null)
        : []
      const history = Array.isArray(o.history)
        ? o.history.filter(
            (h): h is Ability['history'][number] =>
              typeof h === 'object' &&
              h !== null &&
              typeof (h as Record<string, unknown>).date === 'string' &&
              typeof (h as Record<string, unknown>).stepId === 'string' &&
              typeof (h as Record<string, unknown>).value === 'number',
          )
        : []
      return {
        id: typeof o.id === 'string' ? o.id : `ability-restored-${i}`,
        name,
        discipline: o.discipline as Discipline,
        metric: metric as AbilityMetric,
        unit: typeof o.unit === 'string' ? o.unit : undefined,
        goal: typeof o.goal === 'string' ? o.goal : undefined,
        lowerIsBetter: o.lowerIsBetter === true || undefined,
        steps,
        paused: o.paused === true || undefined,
        history,
        createdAt: typeof o.createdAt === 'number' ? o.createdAt : 0,
        updatedAt: typeof o.updatedAt === 'number' ? o.updatedAt : 0,
      }
    })
    .filter((a): a is Ability => a !== null)
}

export function loadAbilities(): Ability[] | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(LS_KEY)
  // null (never saved) is different from "saved an empty board" — the first gets
  // the starter ladders, the second stays empty.
  if (raw === null) return null
  return parseAbilities(raw)
}

export function saveAbilities(list: Ability[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LS_KEY, JSON.stringify(list))
}
