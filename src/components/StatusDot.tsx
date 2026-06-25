import type { Status } from '../types'
import { statusColor, statusLabel } from '../lib/util'

export default function StatusDot({ status }: { status: Status }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-300">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: statusColor(status) }}
        aria-hidden
      />
      {statusLabel(status)}
    </span>
  )
}
