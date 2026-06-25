import type { Project } from '../types'
import { Card } from './Card'
import StatusDot from './StatusDot'
import ProgressRing from './ProgressRing'
import { statusColor, byAttention } from '../lib/util'

export default function ProjectGrid({ projects }: { projects: Project[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {byAttention(projects).map((p) => (
        <Card key={p.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-syrup-100">{p.name}</h3>
              <StatusDot status={p.status} />
            </div>
            <ProgressRing value={p.progress} color={statusColor(p.status)} label={p.name} />
          </div>
          <p className="mt-2 text-xs text-gray-400">{p.summary}</p>
          {p.stack && (
            <div className="mt-2 flex flex-wrap gap-1">
              {p.stack.map((s) => (
                <span key={s} className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] text-gray-400">
                  {s}
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-gray-400">
            <span className="text-gray-500">Next:</span> {p.nextAction}
          </p>
          <div className="mt-2 flex gap-3 text-[11px]">
            {p.liveUrl && (
              <a className="text-syrup-300 hover:underline" href={p.liveUrl} target="_blank" rel="noreferrer noopener">
                live ↗
              </a>
            )}
            {p.repo && <span className="text-gray-500">{p.repo}</span>}
          </div>
        </Card>
      ))}
    </div>
  )
}
