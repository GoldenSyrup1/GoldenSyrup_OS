import { describe, it, expect } from 'vitest'
import { polarPoint, axisAngle, radarPoints, axisPoints, pointsToString } from './radar'

describe('radar geometry', () => {
  it('places the first axis at the top (-90°)', () => {
    expect(axisAngle(0, 8)).toBe(-90)
  })

  it('spaces n axes evenly around the circle', () => {
    expect(axisAngle(1, 4)).toBe(0) // quarter turn from top -> east
    expect(axisAngle(2, 4)).toBe(90) // half turn from top -> south
  })

  it('polarPoint at the top spoke goes straight up', () => {
    const p = polarPoint(100, 100, 50, -90)
    expect(p.x).toBeCloseTo(100, 5)
    expect(p.y).toBeCloseTo(50, 5)
  })

  it('maps a 0..100 value onto the [0,R] spoke', () => {
    // first axis points up; value 100 should reach the rim
    const [first] = radarPoints([100, 0, 0, 0], 100, 100, 60)
    expect(first.y).toBeCloseTo(40, 5) // 100 - 60
    // value 0 sits at the centre
    const [, second] = radarPoints([100, 0, 0, 0], 100, 100, 60)
    expect(second.x).toBeCloseTo(100, 5)
    expect(second.y).toBeCloseTo(100, 5)
  })

  it('clamps out-of-range values', () => {
    const [p] = radarPoints([999], 0, 0, 10) // single axis up, clamps to 100
    expect(p.y).toBeCloseTo(-10, 5)
  })

  it('axisPoints returns n rim vertices', () => {
    expect(axisPoints(8, 50, 50, 40)).toHaveLength(8)
  })

  it('serialises points to an SVG string', () => {
    expect(pointsToString([{ x: 1.005, y: 2 }, { x: 3, y: 4 }])).toBe('1.01,2 3,4')
  })
})
