import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Ability, Discipline, DisciplineRollup, ProgressionStep } from '../types'
import {
  addStep,
  createAbility,
  fitnessSummary,
  loadAbilities,
  logValue,
  moveStep,
  nearestWins,
  removeStep,
  rollupDisciplines,
  saveAbilities,
  updateAbility,
  updateStep,
  type NewAbilityInput,
} from '../lib/fitness'

/** Today as `yyyy-mm-dd` in local time — the date stamped on a manual entry. */
function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export interface FitnessApi {
  abilities: Ability[]
  disciplines: DisciplineRollup[]
  summary: ReturnType<typeof fitnessSummary>
  closest: Ability[]
  selected: Discipline | null
  shown: Ability[]
  selectDiscipline: (d: Discipline | null) => void
  addAbility: (input: NewAbilityInput) => void
  patchAbility: (id: string, patch: Parameters<typeof updateAbility>[1]) => void
  removeAbility: (id: string) => void
  togglePause: (id: string) => void
  addRung: (abilityId: string, step: { name: string; target: number }) => void
  patchRung: (abilityId: string, stepId: string, patch: Partial<Omit<ProgressionStep, 'id'>>) => void
  removeRung: (abilityId: string, stepId: string) => void
  moveRung: (abilityId: string, stepId: string, dir: -1 | 1) => void
  /** The core interaction: record what you can currently do on a rung. */
  log: (abilityId: string, stepId: string, value: number) => void
}

/**
 * Owns the ability board: localStorage persistence plus every edit, routed
 * through the pure helpers in `lib/fitness.ts` so state stays serialisable.
 * The board ships empty on purpose — every ability, rung and number is Sriram's
 * own manual entry, so nothing is seeded or inferred here.
 */
export function useFitness(): FitnessApi {
  const [abilities, setAbilities] = useState<Ability[]>(() => loadAbilities() ?? [])
  const [selected, setSelected] = useState<Discipline | null>(null)

  useEffect(() => {
    saveAbilities(abilities)
  }, [abilities])

  const disciplines = useMemo(() => rollupDisciplines(abilities), [abilities])
  const summary = useMemo(() => fitnessSummary(abilities), [abilities])
  const closest = useMemo(() => nearestWins(abilities), [abilities])

  // Keep the selection valid as disciplines empty out; default to the first.
  useEffect(() => {
    if (disciplines.length === 0) {
      setSelected(null)
    } else if (!selected || !disciplines.some((d) => d.discipline === selected)) {
      setSelected(disciplines[0].discipline)
    }
  }, [disciplines, selected])

  const shown = useMemo(
    () => abilities.filter((a) => a.discipline === selected),
    [abilities, selected],
  )

  /** Replace one ability in the list with a transformed copy. */
  const mutate = useCallback((id: string, fn: (a: Ability) => Ability) => {
    setAbilities((prev) => prev.map((a) => (a.id === id ? fn(a) : a)))
  }, [])

  const addAbility = useCallback((input: NewAbilityInput) => {
    const ability = createAbility(input, Date.now())
    setAbilities((prev) => [...prev, ability])
    setSelected(ability.discipline)
  }, [])

  const patchAbility = useCallback<FitnessApi['patchAbility']>(
    (id, patch) => mutate(id, (a) => updateAbility(a, patch, Date.now())),
    [mutate],
  )

  const removeAbility = useCallback((id: string) => {
    setAbilities((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const togglePause = useCallback(
    (id: string) => mutate(id, (a) => updateAbility(a, { paused: !a.paused }, Date.now())),
    [mutate],
  )

  const addRung = useCallback<FitnessApi['addRung']>(
    (abilityId, step) => mutate(abilityId, (a) => addStep(a, step, Date.now())),
    [mutate],
  )
  const patchRung = useCallback<FitnessApi['patchRung']>(
    (abilityId, stepId, patch) => mutate(abilityId, (a) => updateStep(a, stepId, patch, Date.now())),
    [mutate],
  )
  const removeRung = useCallback<FitnessApi['removeRung']>(
    (abilityId, stepId) => mutate(abilityId, (a) => removeStep(a, stepId, Date.now())),
    [mutate],
  )
  const moveRung = useCallback<FitnessApi['moveRung']>(
    (abilityId, stepId, dir) => mutate(abilityId, (a) => moveStep(a, stepId, dir, Date.now())),
    [mutate],
  )
  const log = useCallback<FitnessApi['log']>(
    (abilityId, stepId, value) =>
      mutate(abilityId, (a) => logValue(a, stepId, value, today(), Date.now())),
    [mutate],
  )

  return {
    abilities,
    disciplines,
    summary,
    closest,
    selected,
    shown,
    selectDiscipline: setSelected,
    addAbility,
    patchAbility,
    removeAbility,
    togglePause,
    addRung,
    patchRung,
    removeRung,
    moveRung,
    log,
  }
}
