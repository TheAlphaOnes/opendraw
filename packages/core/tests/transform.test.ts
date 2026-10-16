import { describe, expect, it } from 'vitest'

import {
  draftLinePoints,
  draftShapeRect,
  moveElements,
  pointerAngle,
  resizeMultipleElements,
  resizeSingleElement,
  rotateElements,
  startRotationAngle,
} from '../src/interaction/transform.js'
import { rotatePoint } from '../src/geometry/points.js'
import { newLinearElement, newRectangleElement } from '../src/elements/factories.js'
import type { VueDrawRectangleElement } from '../src/types.js'


describe('creation drafting', () => {
  it('anchors the shape at the start point', () => {
    const r = draftShapeRect({ x: 10, y: 10 }, { x: 60, y: 50 }, { shift: false })
    expect(r).toEqual({ x: 10, y: 10, width: 50, height: 40 })
  })

  it('normalizes negative drags', () => {
    const r = draftShapeRect({ x: 10, y: 10 }, { x: -30, y: -20 }, { shift: false })
    expect(r).toEqual({ x: -30, y: -20, width: 40, height: 30 })
  })

  it('forces a perfect square with shift', () => {
    const r = draftShapeRect({ x: 10, y: 10 }, { x: 60, y: 50 }, { shift: true })
    expect(r.width).toBe(50)
    expect(r.height).toBe(50)
  })

  it('snaps line angles to 15° with shift', () => {
    // Pointer at ~11.3° snaps to 15° (segment length is preserved).
    const pts = draftLinePoints({ x: 0, y: 0 }, { x: 100, y: 20 }, { shift: true })
    expect(pts).toHaveLength(2)
    const angle = Math.atan2(pts[1]!.y, pts[1]!.x)
    expect(angle).toBeCloseTo(Math.PI / 12, 5)
  })

  it('keeps exact angles unchanged under shift snap', () => {
    const pts = draftLinePoints({ x: 0, y: 0 }, { x: 100, y: 100 }, { shift: true })
    expect(pts[1]!.x).toBeCloseTo(100, 5)
    expect(pts[1]!.y).toBeCloseTo(100, 5)
  })
})

describe('moving', () => {
  it('applies the delta to every original', () => {
    const a = newRectangleElement({ x: 0, y: 0, width: 10, height: 10 })
    const b = newRectangleElement({ x: 100, y: 100, width: 10, height: 10 })
    const patches = moveElements([a, b], { x: 5, y: -5 })
    expect(patches).toEqual([
      { id: a.id, patch: { x: 5, y: -5 } },
      { id: b.id, patch: { x: 105, y: 95 } },
    ])
  })

  it('snaps the selection origin to the grid', () => {
    const a = newRectangleElement({ x: 5, y: 5, width: 10, height: 10 })
    const patches = moveElements([a], { x: 7, y: 7 }, 10)
    // minX 5 + 7 = 12 → rounds to grid 10 → effective delta 5.
    expect(patches[0]!.patch.x).toBe(10)
    expect(patches[0]!.patch.y).toBe(10)
  })
})

describe('single-element resize', () => {
  const rect = (): VueDrawRectangleElement =>
    newRectangleElement({ x: 10, y: 10, width: 100, height: 50 })

  it('grows from the se handle keeping nw anchored', () => {
    const patch = resizeSingleElement(rect(), 'se', { x: 160, y: 80 }, { shift: false })
    expect(patch).toMatchObject({ x: 10, y: 10, width: 150, height: 70 })
  })

  it('grows from the nw handle keeping se anchored', () => {
    const patch = resizeSingleElement(rect(), 'nw', { x: 0, y: 0 }, { shift: false })
    expect(patch).toMatchObject({ x: 0, y: 0, width: 110, height: 60 })
  })

  it('resizes only one axis from a cardinal handle', () => {
    const patch = resizeSingleElement(rect(), 'e', { x: 260, y: 500 }, { shift: false })
    expect(patch).toMatchObject({ x: 10, y: 10, width: 250, height: 50 })
  })

  it('clamps to a minimum size instead of flipping', () => {
    const patch = resizeSingleElement(rect(), 'se', { x: -500, y: -500 }, { shift: false })
    expect((patch as { width: number }).width).toBeGreaterThanOrEqual(1)
    expect((patch as { height: number }).height).toBeGreaterThanOrEqual(1)
  })

  it('keeps the aspect ratio with shift on corners', () => {
    const patch = resizeSingleElement(rect(), 'se', { x: 310, y: 60 }, { shift: true })
    // Raw 300x50 → scale = max(3, 1) = 3 → 300 x 150.
    expect(patch).toMatchObject({ width: 300, height: 150, x: 10, y: 10 })
  })

  it('rescales linear points with the box', () => {
    const line = newLinearElement('line', {
      x: 10,
      y: 10,
      width: 50,
      height: 0,
      points: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
    })
    const patch = resizeSingleElement(line, 'e', { x: 160, y: 10 }, { shift: false }) as {
      points: Array<{ x: number; y: number }>
    }
    expect(patch.points[1]).toEqual({ x: 150, y: 0 })
  })

  it('keeps the opposite scene corner fixed for rotated elements', () => {
    const el = newRectangleElement({ x: 10, y: 10, width: 100, height: 50, angle: Math.PI / 2 })
    // Original rotated NW corner (the anchor) about center (60, 35):
    const anchor = rotatePoint({ x: 10, y: 10 }, { x: 60, y: 35 }, Math.PI / 2)
    expect(anchor.x).toBeCloseTo(85)
    expect(anchor.y).toBeCloseTo(-15)

    // Drag the rotated se handle: pointer in scene space at (15, 135).
    const patch = resizeSingleElement(el, 'se', { x: 15, y: 135 }, { shift: false }) as {
      x: number
      y: number
      width: number
      height: number
    }
    expect(patch.width).toBe(150)
    expect(patch.height).toBe(70)
    // New rotated NW corner must land on the anchor.
    const newCenter = { x: patch.x + patch.width / 2, y: patch.y + patch.height / 2 }
    const newAnchor = rotatePoint({ x: patch.x, y: patch.y }, newCenter, Math.PI / 2)
    expect(newAnchor.x).toBeCloseTo(anchor.x, 5)
    expect(newAnchor.y).toBeCloseTo(anchor.y, 5)
  })
})

describe('multi-element resize', () => {
  it('scales every element about the anchored group edge', () => {
    const a = newRectangleElement({ x: 0, y: 0, width: 100, height: 50 })
    const b = newRectangleElement({ x: 50, y: 50, width: 50, height: 50 })
    const patches = resizeMultipleElements([a, b], 'e', { x: 300, y: 60 }, { shift: false })
    const byId = new Map(patches.map((p) => [p.id, p.patch as Record<string, number>]))
    // Group box 0..100 wide → scaleX = 3.
    expect(byId.get(a.id)!.width).toBe(300)
    expect(byId.get(b.id)!.x).toBe(150)
    expect(byId.get(b.id)!.width).toBe(150)
    expect(byId.get(a.id)!.y).toBeUndefined() // no vertical change from an e handle
  })
})

describe('rotation', () => {
  it('computes pointer angle with 0 = handle straight up', () => {
    const center = { x: 50, y: 50 }
    // Pointer directly above the center → angle 0 (mod 2π).
    expect(pointerAngle(center, { x: 50, y: -50 }) % (Math.PI * 2)).toBeCloseTo(0)
  })

  it('rotates an element about the selection center keeping its pose', () => {
    const el = newRectangleElement({ x: 0, y: 0, width: 50, height: 50 })
    const frame = { x: 0, y: 0, width: 100, height: 100, angle: 0 }
    const startAngle = startRotationAngle(frame, { x: 50, y: -50 })
    // Rotate 90° clockwise (pointer to the right of center).
    const patches = rotateElements([el], frame, startAngle, { x: 150, y: 50 }, { shift: false })
    const patch = patches[0]!.patch as { x: number; y: number; angle: number }
    // Element center (25,25) rotated about (50,50) by +90° → (75,25).
    expect(patch.x).toBeCloseTo(50, 5)
    expect(patch.y).toBeCloseTo(0, 5)
    expect(patch.angle).toBeCloseTo(Math.PI / 2, 5)
  })

  it('snaps rotation to 15° with shift', () => {
    const frame = { x: 0, y: 0, width: 100, height: 100, angle: 0 }
    const startAngle = startRotationAngle(frame, { x: 50, y: -50 })
    // Pointer at an unaligned angle → the applied rotation is a 15° multiple.
    const patches = rotateElements(
      [newRectangleElement({ x: 0, y: 0, width: 10, height: 10 })],
      frame,
      startAngle,
      { x: 150, y: -13.6 },
      { shift: true },
    )
    const patch = patches[0]!.patch as { angle: number }
    // Float-safe: the angle must be a whole number of 15° steps.
    const steps = patch.angle / (Math.PI / 12)
    expect(steps).toBeCloseTo(Math.round(steps), 3)
  })
})
