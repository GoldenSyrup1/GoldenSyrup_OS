import type { Pillar, PillarViewId } from '../types'
import { statusColor } from '../lib/util'
import { Card } from '../components/Card'
import StatusDot from '../components/StatusDot'
import ProgressRing from '../components/ProgressRing'

/** `pillar-<id>` nav leaf → the seed pillar id it points at (`pillar-cyber` → `cyber`). */
export function pillarIdFor(view: PillarViewId): string {
  return view.slice('pillar-'.length)
}

/**
 * Single-pillar detail page. Real seed data (status/progress/next action/signal),
 * just not yet the richer per-pillar breakdown the wireframe implies — that
 * needs its own design, same as the other placeholder leaves.
 */
export default function PillarView({ view, pillars }: { view: PillarViewId; pillars: Pillar[] }) {
  const id = pillarIdFor(view)
  const pillar = pillars.find((p) => p.id === id)

  if (!pillar) {
    return <p className="text-sm text-gray-500">Unknown pillar “{id}”.</p>
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-syrup-300">{pillar.name}</h1>
      <Card className="max-w-xl">
        <div className="flex items-start justify-between gap-3">
          <StatusDot status={pillar.status} />
          <ProgressRing value={pillar.progress} color={statusColor(pillar.status)} label={pillar.name} />
        </div>
        <p className="mt-3 text-sm text-gray-400">
          <span className="text-gray-500">Next:</span> {pillar.nextAction}
        </p>
        {pillar.signal && (
          <p className="mt-2 rounded bg-ink-700 px-2 py-1 text-xs text-syrup-300">📡 {pillar.signal}</p>
        )}
      </Card>
    </div>
  )
}
