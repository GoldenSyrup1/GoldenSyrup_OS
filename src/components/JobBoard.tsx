import type { JobApplication } from '../types'
import { JOB_STAGES, STAGE_LABEL, groupByStage } from '../lib/jobs'

const STAGE_ACCENT: Record<JobApplication['stage'], string> = {
  researching: '#8b949e',
  applied: '#d29922',
  interviewing: '#58a6ff',
  offer: '#3fb950',
  rejected: '#f85149',
}

export default function JobBoard({ jobs }: { jobs: JobApplication[] }) {
  const columns = groupByStage(jobs)

  return (
    <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 lg:grid lg:grid-cols-5 lg:overflow-visible">
      {JOB_STAGES.map((stage) => (
        <div key={stage} className="w-44 shrink-0 snap-start rounded-lg border border-ink-600 bg-ink-800 p-2 lg:w-auto">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: STAGE_ACCENT[stage] }}>
              {STAGE_LABEL[stage]}
            </span>
            <span className="text-[11px] text-gray-500">{columns[stage].length}</span>
          </div>
          <div className="space-y-2">
            {columns[stage].map((j) => (
              <div key={j.id} className="rounded border border-ink-700 bg-ink-900 p-2">
                <p className="truncate text-xs font-medium text-syrup-100">{j.company}</p>
                <p className="truncate text-[11px] text-gray-400">{j.role}</p>
                <p className="mt-1 text-[10px] text-gray-600">{j.updated}</p>
              </div>
            ))}
            {columns[stage].length === 0 && (
              <p className="px-1 text-[10px] text-gray-700">—</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
