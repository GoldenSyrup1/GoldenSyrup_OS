import { useEffect, useState } from 'react'
import { clampProgress } from '../lib/util'

interface Props {
  value: number
  size?: number
  stroke?: number
  color?: string
  label?: string
}

/** Pure SVG progress ring — no chart dependency. Animates the arc on mount/change. */
export default function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  color = '#e0a020',
  label,
}: Props) {
  const pct = clampProgress(value)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  // Animate from empty to `pct` so the arc fills in on first paint.
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct))
    return () => cancelAnimationFrame(id)
  }, [pct])
  const offset = circumference - (shown / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`${label ?? 'progress'} ${pct}%`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#30363d"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <span className="absolute text-xs font-semibold tabular-nums">{pct}%</span>
    </div>
  )
}
