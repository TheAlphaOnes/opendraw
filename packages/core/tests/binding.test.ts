import { describe, expect, it } from 'vitest'

import {
  BASE_BINDING_GAP,
  bindingAt,
  bindingFollowPatches,
  boundTipPoint,
  fixedPointFor,
  focusPointOf,
  normalizeFixedPoint,
  orphanBindingPatches,
  outlineIntersections,
  projectOntoDiagonal,
  rebindAfterDrag,
  resolveTipBinding,
  snappedMidpoint,
} from '../src/elements/binding.js'
import { newEllipseElement, newLinearElement, newRectangleElement } from '../src/elements/factories.js'
import { parseFile } from '../src/export/serialize.js'
import { OpenDrawDocument } from '../src/scene/document.js'
import type { OpenDrawElement, OpenDrawLinearElement, Point } from '../src/types.js'

const sharpBox = (x: number, y: number, w = 100, h = 100) =>
  newRectangleElement({ x, y, width: w, height: h, roundness: null })

function arrow(from: Point, to: Point, patch: Partial<OpenDrawLinearElement> = {}): OpenDrawLinearElement {
  const el = newLinearElement('arrow', {
    x: from.x,
    y: from.y,
    points: [{ x: 0, y: 0 }, { x: to.x - from.x, y: to.y - from.y }],
  }) as OpenDrawLinearElement
  return { ...el, ...patch }
}

const tip = (a: OpenDrawLinearElement, which: 'start' | 'end'): Point => {
  const p = a.points[which === 'start' ? 0 : a.points.length - 1]!
  return { x: a.x + p.x, y: a.y + p.y }
}

/** Gap for the default 2px stroke: BASE_BINDING_GAP + strokeWidth / 2. */
const GAP = BASE_BINDING_GAP + 1

describe('fixed points (Excalidraw normalizeFixedPoint / FixedPointBinding)', () => {
  it('stores where inside the shape a tip aims, surviving moves and resizes', () => {
    const box = sharpBox(0, 0, 200, 100)
    const fixed = fixedPointFor(box, { x: 150, y: 25 })
    expect(fixed).toEqual([0.75, 0.25])
    const moved = { ...box, x: 1000, y: 1000, width: 400 }
    expect(focusPointOf(moved, { fixedPoint: fixed })).toEqual({ x: 1300, y: 1025 })
  })

  it('never stores an exact 0.5 and clamps far-out ratios', () => {
    expect(normalizeFixedPoint([0.5, 0.2])).toEqual([0.5001, 0.2])
    expect(normalizeFixedPoint([40, -40])).toEqual([10, -10])
  })

  it('reads old id-only bindings as an orbit around the center', () => {
    const box = sharpBox(0, 0)
    const legacy = { ...arrow({ x: 200, y: 50 }, { x: 120, y: 50 }), endBinding: { elementId: box.id } }
    const file = parseFile({ type: 'opendraw', version: 1, elements: [box, legacy] })
    const read = file.elements[1] as OpenDrawLinearElement
    expect(read.endBinding).toEqual({ elementId: box.id, fixedPoint: [0.5001, 0.5001], mode: 'orbit' })
  })
})

describe('choosing a binding (the simple strategy)', () => {
  const box = sharpBox(0, 0)
  const loose = arrow({ x: 300, y: 50 }, { x: 300, y: 50 })

  it('stays loose away from shapes', () => {
    expect(resolveTipBinding(loose, 'end', { x: 600, y: 600 }, [box], 1).binding).toBeNull()
  })

  it('binds inside, at the exact point, when the tip is dropped inside a shape', () => {
    const result = resolveTipBinding(loose, 'end', { x: 30, y: 70 }, [box], 1)
    expect(result.binding).toEqual({ elementId: box.id, fixedPoint: [0.3, 0.7], mode: 'inside' })
  })

  it('orbits a side midpoint when dropped just outside near one', () => {
    const result = resolveTipBinding(loose, 'end', { x: 108, y: 52 }, [box], 1)
    expect(result.binding?.mode).toBe('orbit')
    expect(focusPointOf(box, result.binding!)).toEqual({ x: 100, y: 50.01 })
  })

  it('otherwise projects the drop point onto the diagonals along the arrow', () => {
    const from = { x: 300, y: 20 }
    const result = resolveTipBinding(arrow(from, from), 'end', { x: 105, y: 20 }, [box], 1)
    const focus = focusPointOf(box, result.binding!)
    expect(result.binding?.mode).toBe('orbit')
    // On a diagonal of the box, inside it.
    expect(focus.x).toBeGreaterThan(0)
    expect(focus.x).toBeLessThan(100)
    expect(Math.abs(focus.x - focus.y) < 1 || Math.abs(focus.x + focus.y - 100) < 1).toBe(true)
  })

  it('Alt binds inside wherever the tip is', () => {
    const result = resolveTipBinding(loose, 'end', { x: 108, y: 52 }, [box], 1, { inside: true })
    expect(result.binding?.mode).toBe('inside')
  })

  it('binds both ends inside when they land on the same shape', () => {
    const started = { ...loose, startBinding: bindingAt(box, { x: 20, y: 20 }, 'orbit') }
    const result = resolveTipBinding(started, 'end', { x: 80, y: 80 }, [box], 1)
    expect(result.binding?.mode).toBe('inside')
    expect(result.other?.mode).toBe('inside')
  })

  it('snaps to midpoints only from outside the shape', () => {
    expect(snappedMidpoint(box, { x: 100 + 10, y: 50 }, 1)).toEqual({ x: 100, y: 50 })
    expect(snappedMidpoint(box, { x: 95, y: 50 }, 1)).toBeNull()
  })

  it('projection prefers a near midpoint', () => {
    expect(projectOntoDiagonal(box, { x: 50, y: -8 }, { x: 50, y: -200 }, 1)).toEqual({ x: 50, y: 0 })
  })
})

describe('bound tip positions (Excalidraw updateBoundPoint)', () => {
  it('an orbit tip stops on the outline, one gap out, on the line toward the other end', () => {
    const box = sharpBox(0, 0)
    const a = arrow({ x: 300, y: 50 }, { x: 150, y: 50 }, { endBinding: bindingAt(box, { x: 50, y: 50 }, 'orbit') })
    const end = boundTipPoint(a, 'end', [box, a])!
    expect(end.x).toBeCloseTo(100 + GAP)
    expect(end.y).toBeCloseTo(50, 1)
  })

  it('an inside tip sits at its fixed point', () => {
    const box = sharpBox(0, 0)
    const a = arrow({ x: 300, y: 50 }, { x: 150, y: 50 }, { endBinding: bindingAt(box, { x: 30, y: 40 }, 'inside') })
    expect(boundTipPoint(a, 'end', [box, a])).toEqual({ x: 30, y: 40 })
  })

  it('aims from fixed point to fixed point between two bound shapes', () => {
    const left = sharpBox(0, 0)
    const right = sharpBox(400, 0)
    const a = arrow({ x: 100, y: 50 }, { x: 400, y: 50 }, {
      startBinding: bindingAt(left, { x: 50, y: 20 }, 'orbit'),
      endBinding: bindingAt(right, { x: 450, y: 80 }, 'orbit'),
    })
    const start = boundTipPoint(a, 'start', [left, right, a])!
    const end = boundTipPoint(a, 'end', [left, right, a])!
    expect(start.x).toBeCloseTo(100 + GAP, 0)
    expect(end.x).toBeCloseTo(400 - GAP, 0)
    // Both tips lie on the line between the two fixed points.
    const slope = (80 - 20) / (450 - 50)
    expect(start.y).toBeCloseTo(20 + slope * (start.x - 50), 1)
    expect(end.y).toBeCloseTo(20 + slope * (end.x - 50), 1)
  })

  it('follows rounded corners and ellipses', () => {
    const rounded = newRectangleElement({ x: 0, y: 0, width: 200, height: 200, roundness: 'round' })
    const hits = outlineIntersections(rounded, { x: 100, y: 100 }, { x: -100, y: -100 }, 0)
    // A 32px corner arc sits inside the sharp corner along the diagonal.
    expect(hits[0]!.x).toBeGreaterThan(5)
    const ellipse = newEllipseElement({ x: 0, y: 0, width: 200, height: 100 })
    const crossing = outlineIntersections(ellipse, { x: 100, y: 50 }, { x: 400, y: 50 }, 0)[0]!
    expect(crossing.x).toBeCloseTo(200)
  })
})

describe('binding follow-through', () => {
  it('re-aims arrows when their shape moves, keeping the fixed point', () => {
    const box = sharpBox(0, 0)
    const a = arrow({ x: 300, y: 50 }, { x: 106, y: 50 }, { endBinding: bindingAt(box, { x: 50, y: 50 }, 'orbit') })
    const moved = { ...box, y: 200 }
    const patch = bindingFollowPatches(new Set([box.id]), [moved, a]).get(a.id)!
    const end = tip({ ...a, ...patch } as OpenDrawLinearElement, 'end')
    expect(end.y).toBeGreaterThan(200)
  })

  it('leaves an arrow moved together with its shapes alone', () => {
    const box = sharpBox(0, 0)
    const a = arrow({ x: 300, y: 50 }, { x: 106, y: 50 }, { endBinding: bindingAt(box, { x: 50, y: 50 }, 'orbit') })
    expect(bindingFollowPatches(new Set([box.id, a.id]), [box, a]).size).toBe(0)
  })

  it('rebinds or unbinds tips after the arrow itself is dragged', () => {
    const box = sharpBox(0, 0)
    const away = arrow({ x: 500, y: 500 }, { x: 700, y: 500 }, { endBinding: bindingAt(box, { x: 50, y: 50 }, 'orbit') })
    expect(rebindAfterDrag(away, [box, away], 1).endBinding).toBeNull()
    const onto = arrow({ x: 300, y: 50 }, { x: 50, y: 50 })
    expect(rebindAfterDrag(onto, [box, onto], 1).endBinding?.mode).toBe('inside')
  })

  it('drops bindings to deleted shapes, inside the deletion undo step', () => {
    const box = sharpBox(0, 0)
    const a = arrow({ x: 300, y: 50 }, { x: 106, y: 50 }, { endBinding: bindingAt(box, { x: 50, y: 50 }, 'orbit') })
    expect(orphanBindingPatches(new Set([box.id]), [box, a]).get(a.id)).toEqual({ startBinding: null, endBinding: null })
    const doc = new OpenDrawDocument({ elements: [box, a] as OpenDrawElement[] })
    doc.deleteElements([box.id])
    expect((doc.getElement(a.id) as OpenDrawLinearElement).endBinding).toBeNull()
    doc.undo()
    expect((doc.getElement(a.id) as OpenDrawLinearElement).endBinding?.elementId).toBe(box.id)
  })
})
