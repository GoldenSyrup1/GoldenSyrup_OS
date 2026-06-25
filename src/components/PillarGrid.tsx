import type { Pillar } from '../types'
import { Card } from './Card'
import StatusDot from './StatusDot'
import ProgressRing from './ProgressRing'
import { statusColor, byAttention } from '../lib/util'

export default function PillarGrid({ pillars }: { pillars: Pillar[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {byAttention(pillars).map((p) => (
        <Card key={p.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-syrup-100">{p.name}</h3>
              <StatusDot status={p.status} />
            </div>
            <ProgressRing value={p.progress} color={statusColor(p.status)} label={p.name} />
          </div>
          <p className="mt-3 text-xs text-gray-400">
            <span className="text-gray-500">Next:</span> {p.nextAction}
          </p>
          {p.signal && (
            <p className="mt-2 rounded bg-ink-700 px-2 py-1 text-[11px] text-syrup-300">
              📡 {p.signal}
            </p>
          )}
        </Card>
      ))}
    </div>
  )
}
