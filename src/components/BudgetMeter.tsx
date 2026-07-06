import type { BudgetState } from '../lib/runs'

const LEVEL_COLOR: Record<BudgetState['level'], string> = {
  ok: '#3fb950',
  warn: '#d29922',
  over: '#f85149',
}

const LEVEL_NOTE: Record<BudgetState['level'], string> = {
  ok: '',
  warn: 'Running low — heads up before you run out.',
  over: 'Over cap — out of budget for this session.',
}

/** Session spend vs the self-set cap. This is the "credits" advance-warning UI. */
export default function BudgetMeter({
  budget,
  cap,
  onCapChange,
}: {
  budget: BudgetState
  cap: number
  onCapChange: (usd: number) => void
}) {
  const color = LEVEL_COLOR[budget.level]
  const pct = cap > 0 ? Math.min(100, Math.round(budget.fraction * 100)) : 0

  return (
    <div className="rounded-lg border border-ink-600 bg-ink-800 p-3">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wide text-gray-400">Session spend</span>
        <span style={{ color }}>${budget.spent.toFixed(2)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
        <label className="flex items-center gap-1">
          cap $
          <input
            type="number"
            min={0}
            step={1}
            value={cap}
            onChange={(e) => onCapChange(Number(e.target.value))}
            className="w-14 rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-right text-gray-300"
          />
        </label>
        <span>{cap > 0 ? `${pct}% used` : 'untracked'}</span>
      </div>
      {LEVEL_NOTE[budget.level] && (
        <p className="mt-2 text-[11px]" style={{ color }}>
          {LEVEL_NOTE[budget.level]}
        </p>
      )}
    </div>
  )
}
