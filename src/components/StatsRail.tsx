import type { BudgetState } from '../lib/runs'
import BudgetMeter from './BudgetMeter'

/**
 * Right nav — Statistics/Tool Usage. Global (mounted once in App, fed the same
 * budget state the chat panel uses) rather than per-view, so spend read the
 * same everywhere instead of two independently-instantiated counters drifting.
 */
export default function StatsRail({
  open,
  onClose,
  budget,
  cap,
  onCapChange,
}: {
  open: boolean
  onClose: () => void
  budget: BudgetState
  cap: number
  onCapChange: (usd: number) => void
}) {
  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close statistics"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] lg:hidden"
        />
      )}
      <aside
        aria-hidden={!open}
        className={`fixed right-0 top-12 z-50 flex h-[calc(100dvh-3rem)] w-72 flex-col gap-3 overflow-y-auto border-l border-ink-700 bg-ink-900/95 p-3 backdrop-blur-sm transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-syrup-300">Statistics / Tool Usage</h2>

        <BudgetMeter budget={budget} cap={cap} onCapChange={onCapChange} />

        <div className="rounded-lg border border-dashed border-ink-600 bg-ink-800/60 p-3 text-[11px] text-gray-500">
          Other tools + usage stats land here as they're wired up.
        </div>
      </aside>
    </>
  )
}
