import { useState } from 'react'
import type { Ability, AbilityMetric, Discipline, DisciplineRollup, ProgressionStep } from '../types'
import {
  DISCIPLINES,
  DISCIPLINE_ORDER,
  METRICS,
  abilityLevel,
  abilityProgress,
  abilityStatus,
  isStepDone,
  nextStep,
  stepHistory,
  stepRatio,
  unitOf,
} from '../lib/fitness'
import { statusColor } from '../lib/util'
import type { FitnessApi } from '../hooks/useFitness'
import { Card } from './Card'
import ProgressRing from './ProgressRing'
import StatusDot from './StatusDot'

/**
 * Ability-first fitness board: pick a discipline on the left, see every ability
 * you're chasing on the right as a progression ladder you fill in by hand.
 * Nothing is measured or synced — every number here is manual entry.
 */
export default function FitnessBoard(api: FitnessApi) {
  const [adding, setAdding] = useState(false)

  return (
    <div className="space-y-4">
      <SummaryStrip summary={api.summary} closest={api.closest} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        <DisciplineRail
          disciplines={api.disciplines}
          selected={api.selected}
          onSelect={api.selectDiscipline}
          onAdd={() => setAdding((v) => !v)}
          adding={adding}
        />
        <div className="space-y-3">
          {adding && (
            <AbilityComposer
              defaultDiscipline={api.selected ?? 'calisthenics'}
              onCreate={(input) => {
                api.addAbility(input)
                setAdding(false)
              }}
              onCancel={() => setAdding(false)}
            />
          )}
          {api.abilities.length === 0 && !adding ? (
            <EmptyBoard onStart={() => setAdding(true)} />
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {api.shown.map((a) => (
                <AbilityCard key={a.id} ability={a} api={api} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---- header ----------------------------------------------------------------

function SummaryStrip({
  summary,
  closest,
}: {
  summary: FitnessApi['summary']
  closest: Ability[]
}) {
  return (
    <Card className="flex flex-wrap items-center gap-5">
      <ProgressRing value={summary.progress} size={64} label="overall ability" />
      <div className="flex flex-wrap gap-4 text-sm">
        <Stat value={summary.owned} label="owned" color="#3fb950" />
        <Stat value={summary.inProgress} label="in progress" color="#d29922" />
        <Stat value={summary.total - summary.owned - summary.inProgress - summary.paused} label="not started" color="#8b949e" />
        <Stat value={summary.paused} label="paused" color="#f85149" />
      </div>
      {closest.length > 0 && (
        <div className="ml-auto min-w-0">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">Closest to unlocking</div>
          <div className="flex flex-wrap gap-1.5">
            {closest.map((a) => (
              <span
                key={a.id}
                className="rounded-full bg-syrup-500/15 px-2.5 py-1 text-[11px] text-syrup-200"
              >
                {DISCIPLINES[a.discipline].icon} {a.name} · {abilityProgress(a)}%
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div>
      <div className="text-xl font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  )
}

// ---- left rail -------------------------------------------------------------

function DisciplineRail({
  disciplines,
  selected,
  onSelect,
  onAdd,
  adding,
}: {
  disciplines: DisciplineRollup[]
  selected: Discipline | null
  onSelect: (d: Discipline) => void
  onAdd: () => void
  adding: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onAdd}
        className="rounded-lg border border-syrup-700 bg-syrup-500/10 px-3 py-2 text-xs font-semibold text-syrup-200 transition-colors hover:bg-syrup-500/20"
      >
        {adding ? '× Cancel' : '+ New ability'}
      </button>
      <div role="tablist" aria-label="Disciplines" className="flex flex-col gap-2">
        {disciplines.map((d) => {
          const meta = DISCIPLINES[d.discipline]
          const active = d.discipline === selected
          return (
            <button
              key={d.discipline}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(d.discipline)}
              className={`flex items-center gap-3 rounded-xl border p-2.5 text-left transition-all ${
                active ? 'border-syrup-700 bg-syrup-500/10' : 'border-ink-600 bg-ink-800/60 hover:border-ink-500'
              }`}
            >
              <ProgressRing value={d.progress} size={40} stroke={4} color={statusColor(d.status)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-gray-100">
                  {meta.icon} {meta.label}
                </span>
                <span className="block text-[11px] text-gray-500">
                  {d.ownedCount}/{d.abilityCount} owned
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---- ability card ----------------------------------------------------------

function AbilityCard({ ability, api }: { ability: Ability; api: FitnessApi }) {
  const [open, setOpen] = useState(false)
  const progress = abilityProgress(ability)
  const status = abilityStatus(ability)
  const level = abilityLevel(ability)
  const next = nextStep(ability)
  const unit = unitOf(ability)

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <ProgressRing value={progress} size={52} color={statusColor(status)} label={ability.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-100">{ability.name}</h3>
            {ability.paused && (
              <span className="rounded-full bg-status-blocked/15 px-2 py-0.5 text-[10px] text-status-blocked">
                paused
              </span>
            )}
          </div>
          {ability.goal && <p className="line-clamp-2 text-xs text-gray-400">{ability.goal}</p>}
          <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
            <StatusDot status={status} />
            <span>
              Level {level.done}/{level.total}
            </span>
          </div>
        </div>
      </div>

      <LadderStrip ability={ability} />

      {next ? (
        <QuickLog ability={ability} step={next} unit={unit} onLog={(v) => api.log(ability.id, next.id, v)} />
      ) : (
        <p className="text-xs text-status-live">
          {level.total === 0 ? 'Add the progression steps to start tracking.' : '✓ Ability owned — every step at target.'}
        </p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-gray-500">
        <button type="button" onClick={() => setOpen((v) => !v)} className="hover:text-syrup-300">
          {open ? '⌃ Hide ladder' : '⌄ Edit ladder'}
        </button>
        <button type="button" onClick={() => api.togglePause(ability.id)} className="hover:text-syrup-300">
          {ability.paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button
          type="button"
          onClick={() => api.removeAbility(ability.id)}
          className="ml-auto hover:text-status-blocked"
        >
          Delete
        </button>
      </div>

      {open && <LadderEditor ability={ability} api={api} unit={unit} />}
    </Card>
  )
}

/** The progression ladder as a segmented bar — one segment per rung, filled by ratio. */
function LadderStrip({ ability }: { ability: Ability }) {
  if (ability.steps.length === 0) {
    return <div className="h-2 rounded-full border border-dashed border-ink-600" />
  }
  return (
    <div className="flex gap-1" aria-hidden>
      {ability.steps.map((s) => {
        const ratio = stepRatio(s, ability.lowerIsBetter)
        return (
          <div key={s.id} className="h-2 flex-1 overflow-hidden rounded-full bg-ink-700" title={s.name}>
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${Math.round(ratio * 100)}%`,
                backgroundColor: ratio >= 1 ? '#3fb950' : '#e0a020',
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

/** Manual entry for the rung you're currently on — the main thing you touch. */
function QuickLog({
  ability,
  step,
  unit,
  onLog,
}: {
  ability: Ability
  step: ProgressionStep
  unit: string
  onLog: (value: number) => void
}) {
  const [value, setValue] = useState('')
  const binary = ability.metric === 'binary'
  const history = stepHistory(ability, step.id)

  const submit = () => {
    const n = Number(value)
    if (!Number.isFinite(n)) return
    onLog(n)
    setValue('')
  }

  return (
    <div className="rounded-lg border border-ink-600 bg-ink-900/60 p-2.5">
      <div className="mb-1.5 text-[10px] uppercase tracking-wide text-gray-500">Next step</div>
      <div className="mb-2 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs text-gray-200">{step.name}</span>
        <Sparkline points={history.map((h) => h.value)} lowerIsBetter={ability.lowerIsBetter} />
      </div>
      {binary ? (
        <button
          type="button"
          onClick={() => onLog(1)}
          className="rounded-lg bg-syrup-500 px-3 py-1.5 text-xs font-semibold text-ink-900 transition-colors hover:bg-syrup-300"
        >
          Mark done ✓
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={String(step.current)}
            aria-label={`Current best for ${step.name}`}
            className="w-20 rounded-lg border border-ink-600 bg-ink-900 px-2 py-1.5 text-xs tabular-nums text-gray-100 focus:border-syrup-700 focus:outline-none"
          />
          <span className="text-[11px] text-gray-500">
            now {step.current}{unit && ` ${unit}`} · target {step.target}
            {unit && ` ${unit}`}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={value.trim() === ''}
            className="ml-auto rounded-lg bg-syrup-500 px-3 py-1.5 text-xs font-semibold text-ink-900 transition-colors hover:bg-syrup-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Log
          </button>
        </div>
      )}
    </div>
  )
}

/** Tiny trend of the entries logged against one rung. Nothing to draw under 2 points. */
function Sparkline({ points, lowerIsBetter }: { points: number[]; lowerIsBetter?: boolean }) {
  if (points.length < 2) return null
  const w = 56
  const h = 16
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((p - min) / span) * h
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const first = points[0]
  const last = points[points.length - 1]
  const improving = lowerIsBetter ? last < first : last > first
  return (
    <svg width={w} height={h} role="img" aria-label={`${points.length} entries logged`} className="shrink-0">
      <path d={d} fill="none" stroke={improving ? '#3fb950' : '#8b949e'} strokeWidth={1.5} />
    </svg>
  )
}

/** Full ladder: edit every rung, reorder it, or add another. */
function LadderEditor({ ability, api, unit }: { ability: Ability; api: FitnessApi; unit: string }) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')

  const add = () => {
    const clean = name.trim()
    if (!clean) return
    api.addRung(ability.id, { name: clean, target: Number(target) || (ability.metric === 'binary' ? 1 : 0) })
    setName('')
    setTarget('')
  }

  return (
    <div className="space-y-2 border-t border-ink-700 pt-3">
      {ability.steps.map((s, i) => {
        const done = isStepDone(s, ability.lowerIsBetter)
        return (
          <div key={s.id} className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`w-5 shrink-0 tabular-nums ${done ? 'text-status-live' : 'text-gray-600'}`}>
              {done ? '✓' : i + 1}
            </span>
            <input
              value={s.name}
              onChange={(e) => api.patchRung(ability.id, s.id, { name: e.target.value })}
              aria-label={`Step ${i + 1} name`}
              className="min-w-0 flex-1 rounded border border-ink-700 bg-ink-900 px-2 py-1 text-gray-200 focus:border-syrup-700 focus:outline-none"
            />
            <input
              type="number"
              value={s.current}
              onChange={(e) => api.patchRung(ability.id, s.id, { current: Number(e.target.value) })}
              aria-label={`Step ${i + 1} current`}
              className="w-16 rounded border border-ink-700 bg-ink-900 px-2 py-1 tabular-nums text-gray-200 focus:border-syrup-700 focus:outline-none"
            />
            <span className="text-gray-600">/</span>
            <input
              type="number"
              value={s.target}
              onChange={(e) => api.patchRung(ability.id, s.id, { target: Number(e.target.value) })}
              aria-label={`Step ${i + 1} target`}
              className="w-16 rounded border border-ink-700 bg-ink-900 px-2 py-1 tabular-nums text-gray-200 focus:border-syrup-700 focus:outline-none"
            />
            <span className="w-14 shrink-0 text-[10px] text-gray-600">{unit}</span>
            <button
              type="button"
              onClick={() => api.moveRung(ability.id, s.id, -1)}
              aria-label={`Move step ${i + 1} up`}
              className="text-gray-600 hover:text-syrup-300"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => api.moveRung(ability.id, s.id, 1)}
              aria-label={`Move step ${i + 1} down`}
              className="text-gray-600 hover:text-syrup-300"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => api.removeRung(ability.id, s.id)}
              aria-label={`Delete step ${i + 1}`}
              className="text-gray-600 hover:text-status-blocked"
            >
              ✕
            </button>
          </div>
        )
      })}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="add a progression step…"
          aria-label={`Add a step to ${ability.name}`}
          className="min-w-0 flex-1 rounded border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-gray-200 placeholder:text-gray-600 focus:border-syrup-700 focus:outline-none"
        />
        <input
          type="number"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="target"
          aria-label={`Target for the new step on ${ability.name}`}
          className="w-20 rounded border border-ink-700 bg-ink-900 px-2 py-1 text-xs tabular-nums text-gray-200 placeholder:text-gray-600 focus:border-syrup-700 focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          disabled={!name.trim()}
          className="rounded border border-syrup-700 px-2 py-1 text-xs text-syrup-200 disabled:opacity-40"
        >
          Add step
        </button>
      </div>
    </div>
  )
}

// ---- new ability composer --------------------------------------------------

function AbilityComposer({
  defaultDiscipline,
  onCreate,
  onCancel,
}: {
  defaultDiscipline: Discipline
  onCreate: (input: {
    name: string
    discipline: Discipline
    metric: AbilityMetric
    unit?: string
    goal?: string
    lowerIsBetter?: boolean
  }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [discipline, setDiscipline] = useState<Discipline>(defaultDiscipline)
  const [metric, setMetric] = useState<AbilityMetric>('reps')
  const [unit, setUnit] = useState('')
  const [goal, setGoal] = useState('')
  const [lowerIsBetter, setLowerIsBetter] = useState(false)

  const submit = () => {
    if (!name.trim()) return
    onCreate({
      name,
      discipline,
      metric,
      unit: unit.trim() || undefined,
      goal: goal.trim() || undefined,
      lowerIsBetter: lowerIsBetter || undefined,
    })
  }

  const field = 'rounded-lg border border-ink-600 bg-ink-900 px-2 py-1.5 text-xs text-gray-200 placeholder:text-gray-600 focus:border-syrup-700 focus:outline-none'

  return (
    <Card className="space-y-2">
      <div className="text-sm font-semibold text-syrup-100">➕ New ability</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="what you want to be able to do (e.g. freestanding handstand)"
        aria-label="Ability name"
        className={`w-full ${field}`}
      />
      <input
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="what owning it looks like (optional)"
        aria-label="Ability goal"
        className={`w-full ${field}`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={discipline}
          onChange={(e) => setDiscipline(e.target.value as Discipline)}
          aria-label="Discipline"
          className={field}
        >
          {DISCIPLINE_ORDER.map((d) => (
            <option key={d} value={d}>
              {DISCIPLINES[d].icon} {DISCIPLINES[d].label}
            </option>
          ))}
        </select>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value as AbilityMetric)}
          aria-label="Measured in"
          className={field}
        >
          {(Object.keys(METRICS) as AbilityMetric[]).map((m) => (
            <option key={m} value={m}>
              {METRICS[m].label}
              {METRICS[m].unit && ` (${METRICS[m].unit})`}
            </option>
          ))}
        </select>
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder={`unit — default ${METRICS[metric].unit || 'none'}`}
          aria-label="Unit override"
          className={`w-40 ${field}`}
        />
        <label className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <input
            type="checkbox"
            checked={lowerIsBetter}
            onChange={(e) => setLowerIsBetter(e.target.checked)}
            className="accent-syrup-500"
          />
          lower is better (times)
        </label>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim()}
          className="rounded-lg bg-syrup-500 px-4 py-1.5 text-xs font-semibold text-ink-900 transition-colors hover:bg-syrup-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Create ability
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-300">
          Cancel
        </button>
        <span className="ml-auto text-[10px] text-gray-600">then add its progression steps on the card</span>
      </div>
    </Card>
  )
}

function EmptyBoard({ onStart }: { onStart: () => void }) {
  return (
    <Card className="space-y-2 text-sm text-gray-300">
      <p className="font-semibold text-syrup-100">Track what you can do, not what you did</p>
      <p className="text-gray-400">
        Add an ability you want to own — a handstand, a pistol squat, a flat split, a 540 kick — then
        give it the progression steps that lead there and the number you can currently hit on each.
        Progress is the share of that ladder you actually own.
      </p>
      <p className="text-[11px] text-gray-500">
        Every value is manual entry. Nothing syncs from a device, nothing is estimated. Diet is out of scope.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="rounded-lg bg-syrup-500 px-4 py-1.5 text-xs font-semibold text-ink-900 transition-colors hover:bg-syrup-300"
      >
        + Add your first ability
      </button>
    </Card>
  )
}
