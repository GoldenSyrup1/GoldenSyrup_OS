import type { Run } from '../types'
import { RUN_STATUS_COLOR, RUN_STATUS_LABEL, isActive, sortByNewest } from '../lib/runs'

function time(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}

export default function RunQueue({ runs, onClear }: { runs: Run[]; onClear: (id: string) => void }) {
  if (runs.length === 0) {
    return <p className="px-1 py-6 text-center text-xs text-gray-600">No runs yet — select a target and send a prompt.</p>
  }

  return (
    <ul className="space-y-2">
      {sortByNewest(runs).map((r) => {
        const color = RUN_STATUS_COLOR[r.status]
        return (
          <li key={r.id} className="rounded-lg border border-ink-700 bg-ink-900 p-3">
            <div className="mb-1 flex items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${isActive(r.status) ? 'animate-glow-pulse' : ''}`}
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <span className="text-xs font-medium text-syrup-100">{r.targetLabel}</span>
              <span className="text-[10px] uppercase tracking-wide" style={{ color }}>
                {RUN_STATUS_LABEL[r.status]}
              </span>
              <span className="ml-auto text-[10px] text-gray-600">{time(r.createdAt)}</span>
              {!isActive(r.status) && (
                <button
                  type="button"
                  onClick={() => onClear(r.id)}
                  className="text-[10px] text-gray-600 hover:text-status-blocked"
                  aria-label="dismiss run"
                >
                  ✕
                </button>
              )}
            </div>
            <p className="truncate text-[11px] text-gray-400" title={r.prompt}>
              “{r.prompt}”
            </p>
            {r.log.length > 0 && (
              <div className="mt-2 space-y-0.5 rounded bg-ink-800 p-2 font-mono text-[10px] leading-relaxed text-gray-500">
                {r.log.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            )}
            {r.result && (
              <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-ink-800 p-2 text-[10px] text-gray-300">
                {r.result}
              </pre>
            )}
            {r.error && <p className="mt-2 text-[11px] text-status-blocked">{r.error}</p>}
            {typeof r.costUsd === 'number' && r.costUsd > 0 && (
              <p className="mt-1 text-right text-[10px] text-gray-600">${r.costUsd.toFixed(3)}</p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
