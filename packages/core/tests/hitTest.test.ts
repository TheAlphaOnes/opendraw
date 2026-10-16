import { describe, expect, it } from 'vitest'

import {
  elementsInBounds,
  findElementAt,
  hitTestElement,
  hitThreshold,
  isPathALoop,
  pointInPolygon,
} from '../src/elements/hitTest.js'
import {
  newDiamondElement,
  newEllipseElement,
  newFreedrawElement,
  newLinearElement,
  newRectangleElement,
} from '../src/elements/factories.js'

const T = hitThreshold(1) // ~6.8 scene px at zoom 1

describe('thresholds', () => {
  it('scales inversely with zoom', () => {
    expect(hitThreshold(2)).toBeCloseTo(hitThreshold(1) / 2)
  })
})

describe('rectangles', () => {
  it('misses the interior when the background is transparent', () => {
    const el = newRectangleElement({ x: 10, y: 10, width: 100, height: 50 })
    expect(hitTestElement(el, { x: 60, y: 35 }, T)).toBe(false)
  })

  it('hits the interior when the background is opaque', () => {
    const el = newRectangleElement({
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      style: { backgroundColor: '#ffc9c9' },
    })
    expect(hitTestElement(el, { x: 60, y: 35 }, T)).toBe(true)
  })

  it('hits the stroke within the threshold', () => {
    const el = newRectangleElement({ x: 10, y: 10, width: 100, height: 50 })
    expect(hitTestElement(el, { x: 10, y: 30 }, T)).toBe(true) // left edge
    // Left OF the edge, outside the threshold.
    expect(hitTestElement(el, { x: 10 - T - 5, y: 30 }, T)).toBe(false)
  })

  it('accounts for rotation by un-rotating the point', () => {
    const el = newRectangleElement({
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      angle: Math.PI / 2,
      style: { backgroundColor: '#b2f2bb' },
    })
    // Rotated 90° about (60, 35): occupies x in [35,85], y in [10,110].
    expect(hitTestElement(el, { x: 60, y: 35 }, T)).toBe(true)
    // 15px right of the rotated box's right edge (x=85).
    expect(hitTestElement(el, { x: 100, y: 35 }, T)).toBe(false)
  })
})

describe('ellipse', () => {
  it('tests the normalized ellipse equation inside', () => {
    const el = newEllipseElement({
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      style: { backgroundColor: '#a5d8ff' },
    })
    expect(hitTestElement(el, { x: 60, y: 35 }, T)).toBe(true)
    // 10px right of the right vertex (x=110) — outside the threshold.
    expect(hitTestElement(el, { x: 120, y: 35 }, T)).toBe(false)
  })

  it('hits the outline just outside the edge', () => {
    const el = newEllipseElement({ x: 10, y: 10, width: 100, height: 50 })
    expect(hitTestElement(el, { x: 110, y: 35 }, T)).toBe(true) // right vertex
  })
})

describe('diamond', () => {
  it('tests the manhattan metric inside', () => {
    const el = newDiamondElement({
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      style: { backgroundColor: '#ffec99' },
    })
    expect(hitTestElement(el, { x: 60, y: 20 }, T)).toBe(true)
    expect(hitTestElement(el, { x: 100, y: 20 }, T)).toBe(false)
  })

  it('hits the outline edges', () => {
    const el = newDiamondElement({ x: 10, y: 10, width: 100, height: 50 })
    // Midpoint of the top-left edge: between (60,10) and (10,35).
    expect(hitTestElement(el, { x: 35, y: 22.5 }, T)).toBe(true)
  })
})

describe('lines and arrows', () => {
  it('hits within the threshold of the segment', () => {
    const el = newLinearElement('line', {
      x: 10,
      y: 10,
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    })
    expect(hitTestElement(el, { x: 60, y: 13 }, T)).toBe(true)
    expect(hitTestElement(el, { x: 60, y: 30 }, T)).toBe(false)
  })

  it('never registers interior hits for open paths', () => {
    const el = newLinearElement('arrow', {
      x: 10,
      y: 10,
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      style: { backgroundColor: '#ffc9c9' },
    })
    expect(hitTestElement(el, { x: 60, y: 13 }, T)).toBe(true) // near the stroke
  })
})

describe('freedraw', () => {
  it('hits the drawn path, not the bounding box', () => {
    const el = newFreedrawElement({
      x: 10,
      y: 10,
      points: [[0, 0, 0.5], [100, 0, 0.5]],
    })
    expect(hitTestElement(el, { x: 60, y: 13 }, T)).toBe(true)
    expect(hitTestElement(el, { x: 60, y: 60 }, T)).toBe(false)
  })
})

describe('z-order and marquee', () => {
  it('finds the topmost element', () => {
    const bottom = newRectangleElement({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      style: { backgroundColor: '#ffc9c9' },
    })
    const top = newRectangleElement({
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      style: { backgroundColor: '#b2f2bb' },
    })
    const hit = findElementAt([bottom, top], { x: 30, y: 30 }, T)
    expect(hit?.id).toBe(top.id)
  })

  it('selects elements intersecting a marquee bounds', () => {
    const a = newRectangleElement({ x: 0, y: 0, width: 10, height: 10 })
    const b = newRectangleElement({ x: 100, y: 100, width: 10, height: 10 })
    const hits = elementsInBounds([a, b], { x1: -5, y1: -5, x2: 20, y2: 20 })
    expect(hits.map((el) => el.id)).toEqual([a.id])
  })
})

describe('geometry helpers', () => {
  it('detects closed loops', () => {
    const loop = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 5, y: 0 },
    ]
    expect(isPathALoop(loop, 10)).toBe(true)
    const open = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
    ]
    expect(isPathALoop(open, 10)).toBe(false)
  })

  it('runs even-odd polygon membership', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true)
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false)
  })
})
