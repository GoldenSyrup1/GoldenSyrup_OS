// Pure geometry for the revolution radar chart — no chart dependency.
import { clampProgress } from './util'

export interface Point {
  x: number
  y: number
}

/** Cartesian point at `radius` and `angleDeg` (0° = east, clockwise) from a centre. */
export function polarPoint(cx: number, cy: number, radius: number, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
}

/** Angle (deg) of axis `i` of `n`, starting at the top (-90°) and going clockwise. */
export function axisAngle(i: number, n: number): number {
  return -90 + (360 / n) * i
}

/** Points of a radar polygon: each 0..100 value mapped onto the [0,R] spoke. */
export function radarPoints(values: number[], cx: number, cy: number, R: number): Point[] {
  const n = values.length
  return values.map((v, i) =>
    polarPoint(cx, cy, (clampProgress(v) / 100) * R, axisAngle(i, n)),
  )
}

/** The outer vertices (value = 100) for axis spokes / grid rings. */
export function axisPoints(n: number, cx: number, cy: number, R: number): Point[] {
  return Array.from({ length: n }, (_, i) => polarPoint(cx, cy, R, axisAngle(i, n)))
}

/** SVG `points` attribute string, rounded for stable output. */
export function pointsToString(points: Point[]): string {
  return points.map((p) => `${round(p.x)},${round(p.y)}`).join(' ')
}

function round(n: number): number {
  // Nudge by one ulp so exact halves (e.g. 1.005) round up instead of being
  // dragged down by binary float representation (1.005*100 === 100.4999…).
  return Math.round((n + Number.EPSILON) * 100) / 100
}
