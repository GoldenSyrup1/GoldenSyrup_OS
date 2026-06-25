import type { MemoryItem } from '../data/adapters'
import { Card } from './Card'

export default function ActivityFeed({ items }: { items: MemoryItem[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <p className="text-xs text-gray-600">
          No live memory feed. Set <code className="text-syrup-300">VITE_CONNECTOR_API_BASE</code> to stream
          recent claude_connector memories here.
        </p>
      </Card>
    )
  }
  return (
    <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
      {items.map((m, i) => (
        <Card key={`${m.created_at}-${i}`}>
          <div className="mb-1 flex items-center justify-between text-[10px] text-gray-500">
            <span>{m.source}</span>
            <span>{m.created_at?.slice(0, 10)}</span>
          </div>
          <p className="line-clamp-3 text-xs text-gray-300">{m.content}</p>
          {m.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {m.tags.slice(0, 5).map((t) => (
                <span key={t} className="rounded bg-ink-700 px-1 py-0.5 text-[9px] text-gray-500">
                  {t}
                </span>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
