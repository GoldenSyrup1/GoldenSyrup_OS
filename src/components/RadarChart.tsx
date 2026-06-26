import type { Pillar } from '../types'
import { radarPoints, axisPoints, axisAngle, polarPoint, pointsToString } from '../lib/radar'

const RINGS = [25, 50, 75, 100]

/** Pure-SVG radar of the 8 revolution pillars' progress. Visual-first, no deps. */
export default function RadarChart({ pillars, size = 280 }: { pillars: Pillar[]; size?: number }) {
  const cx = size / 2
  const cy = size / 2
  const R = size / 2 - 34 // leave room for labels
  const n = pillars.length

  const valuePts = radarPoints(pillars.map((p) => p.progress), cx, cy, R)
  const rim = axisPoints(n, cx, cy, R)

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-auto w-full max-w-[320px]"
      role="img"
      aria-label="Revolution pillar progress radar"
    >
      {/* grid rings */}
      {RINGS.map((pct) => (
        <polygon
          key={pct}
          points={pointsToString(axisPoints(n, cx, cy, (pct / 100) * R))}
          fill="none"
          stroke="#21262d"
          strokeWidth={1}
        />
      ))}

      {/* spokes */}
      {rim.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#21262d" strokeWidth={1} />
      ))}

      {/* value polygon */}
      <polygon
        points={pointsToString(valuePts)}
        fill="rgba(224,160,32,0.18)"
        stroke="#e0a020"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {valuePts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#f5c451" />
      ))}

      {/* labels */}
      {pillars.map((p, i) => {
        const lp = polarPoint(cx, cy, R + 16, axisAngle(i, n))
        const anchor = lp.x < cx - 4 ? 'end' : lp.x > cx + 4 ? 'start' : 'middle'
        return (
          <text
            key={p.id}
            x={lp.x}
            y={lp.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize={9}
            fill="#8b949e"
          >
            {p.name.split(' / ')[0]}
          </text>
        )
      })}
    </svg>
  )
}
