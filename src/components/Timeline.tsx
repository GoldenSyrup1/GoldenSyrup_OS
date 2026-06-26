import type { Milestone } from '../types'
import { statusColor } from '../lib/util'
import { sortByDate, formatRelative, isPast } from '../lib/dates'

const KIND_ICON: Record<Milestone['kind'], string> = {
  hackathon: '🏆',
  unsw: '🎓',
  event: '📌',
}

/** Vertical, date-sorted timeline of hackathons + UNSW milestones. */
export default function Timeline({ milestones, now }: { milestones: Milestone[]; now: string }) {
  if (milestones.length === 0) {
    return <p className="text-xs text-gray-500">No upcoming milestones.</p>
  }

  const ordered = sortByDate(milestones)

  return (
    <ol className="relative ml-2 space-y-4 border-l border-ink-600 pl-5">
      {ordered.map((m) => {
        const past = isPast(m.date, now)
        return (
          <li key={m.id} className="relative">
            <span
              className="absolute -left-[27px] top-1 grid h-4 w-4 place-items-center rounded-full ring-2 ring-ink-900"
              style={{ backgroundColor: statusColor(m.status) }}
              aria-hidden
            />
            <div className="flex items-baseline justify-between gap-2">
              <h3 className={`text-sm font-semibold ${past ? 'text-gray-500' : 'text-syrup-100'}`}>
                {KIND_ICON[m.kind]} {m.title}
              </h3>
              <span className="shrink-0 text-[11px] tabular-nums text-gray-500">
                {formatRelative(m.date, now)}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-gray-600">{m.date}</div>
            {m.detail && <p className="mt-1 text-xs text-gray-400">{m.detail}</p>}
          </li>
        )
      })}
    </ol>
  )
}
