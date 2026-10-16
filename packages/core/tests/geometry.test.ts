import { describe, expect, it } from 'vitest'

import {
  boundsContain,
  boundsIntersect,
  boundsOfPoints,
  elementCorners,
  getCommonBounds,
  getElementBounds,
  pointInBounds,
  translateBounds,
} from '../src/geometry/bounds.js'
import {
  angleDelta,
  angleOf,
  distance,
  distanceToSegment,
  rotatePoint,
  snapAngle,
  unrotatePoint,
} from '../src/geometry/points.js'
import { newRectangleElement } from '../src/elements/factories.js'
import type { Point } from '../src/types.js'

describe('points', () => {
  it('rotates a point around an origin', () => {
    const p = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, Math.PI / 2)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(10)
  })

  it('un-rotate is the inverse of rotate', () => {
    const origin = { x: 33, y: -12 }
    const p: Point = { x: 100, y: 40 }
    const rotated = rotatePoint(p, origin, 1.234)
    const back = unrotatePoint(rotated, origin, 1.234)
    expect(back.x).toBeCloseTo(p.x)
    expect(back.y).toBeCloseTo(p.y)
  })

  it('measures distance to segments with clamping', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 10, y: 0 }
    expect(distanceToSegment({ x: 5, y: 3 }, a, b)).toBeCloseTo(3)
    // Beyond the endpoints clamps to the nearest endpoint.
    expect(distanceToSegment({ x: -5, y: 0 }, a, b)).toBeCloseTo(5)
  })

  it('computes signed angle deltas in (-PI, PI]', () => {
    expect(angleDelta(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2)
    expect(angleDelta(0, (3 * Math.PI) / 2)).toBeCloseTo(-Math.PI / 2)
  })

  it('snaps angles to a step', () => {
    const step = Math.PI / 12
    expect(snapAngle(0.2, step)).toBeCloseTo(step)
    expect(snapAngle(-0.1, step)).toBeCloseTo(0)
  })

  it('exposes plain distance and angle helpers', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
    expect(angleOf({ x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(Math.PI / 4)
  })
})

describe('bounds', () => {
  it('computes bounds of points', () => {
    const b = boundsOfPoints([
      { x: 5, y: 7 },
      { x: -2, y: 12 },
    ])
    expect(b).toEqual({ x1: -2, y1: 7, x2: 5, y2: 12 })
  })

  it('computes unrotated corners directly', () => {
    const el = newRectangleElement({ x: 10, y: 20, width: 30, height: 40 })
    const corners = elementCorners(el)
    expect(corners).toEqual([
      { x: 10, y: 20 },
      { x: 40, y: 20 },
      { x: 40, y: 60 },
      { x: 10, y: 60 },
    ])
  })

  it('rotates corners around the element center', () => {
    const el = newRectangleElement({ x: 0, y: 0, width: 20, height: 20, angle: Math.PI / 2 })
    const corners = elementCorners(el)
    // NW (0,0) rotates to (20, 0) around center (10,10).
    expect(corners[0]!.x).toBeCloseTo(20)
    expect(corners[0]!.y).toBeCloseTo(0)
  })

  it('computes rotation-aware AABB for rotated elements', () => {
    const el = newRectangleElement({ x: 0, y: 0, width: 20, height: 10, angle: Math.PI / 2 })
    const b = getElementBounds(el)
    // Rotated 90°, the 20x10 rect becomes 10x20 around center (10,5).
    expect(b.x1).toBeCloseTo(5)
    expect(b.y1).toBeCloseTo(-5)
    expect(b.x2).toBeCloseTo(15)
    expect(b.y2).toBeCloseTo(15)
  })

  it('unions common bounds across elements', () => {
    const a = newRectangleElement({ x: 0, y: 0, width: 10, height: 10 })
    const b = newRectangleElement({ x: 50, y: 50, width: 10, height: 10 })
    const common = getCommonBounds([a, b])
    expect(common).toEqual({ x1: 0, y1: 0, x2: 60, y2: 60 })
  })

  it('tests intersection, containment and point membership', () => {
    const box = { x1: 0, y1: 0, x2: 10, y2: 10 }
    expect(boundsIntersect(box, { x1: 5, y1: 5, x2: 15, y2: 15 })).toBe(true)
    expect(boundsIntersect(box, { x1: 11, y1: 0, x2: 20, y2: 10 })).toBe(false)
    expect(boundsContain(box, { x1: 2, y1: 2, x2: 8, y2: 8 })).toBe(true)
    expect(boundsContain(box, { x1: -1, y1: 0, x2: 5, y2: 5 })).toBe(false)
    expect(pointInBounds({ x: 5, y: 5 }, box)).toBe(true)
    expect(pointInBounds({ x: 15, y: 5 }, box)).toBe(false)
  })

  it('translates bounds', () => {
    expect(translateBounds({ x1: 1, y1: 2, x2: 3, y2: 4 }, 10, -10)).toEqual({
      x1: 11,
      y1: -8,
      x2: 13,
      y2: -6,
    })
  })
})
