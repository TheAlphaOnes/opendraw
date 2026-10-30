import { describe, expect, it } from 'vitest'

import { bindingAt, bindingFollowPatches, BASE_BINDING_GAP } from '../src/elements/binding.js'
import { elbowArrowPath, elbowRoutePatch, elbowSnapPoint, routeElbow } from '../src/elements/elbowArrow.js'
import { newDiamondElement, newEllipseElement, newLinearElement, newRectangleElement } from '../src/elements/factories.js'
import { parseFile } from '../src/export/serialize.js'
import { OpenDrawDocument } from '../src/scene/document.js'
import type { OpenDrawElement, OpenDrawLinearElement, Point } from '../src/types.js'

const box = (x: number, y: number, w = 100, h = 80) => newRectangleElement({ x, y, width: w, height: h, roundness: null })

function elbow(from: Point, to: Point, patch: Partial<OpenDrawLinearElement> = {}): OpenDrawLinearElement {
  const el = newLinearElement('arrow', {
    x: from.x,
    y: from.y,
    points: [{ x: 0, y: 0 }, { x: to.x - from.x, y: to.y - from.y }],
  }) as OpenDrawLinearElement
  return { ...el, elbowed: true, roundness: null, ...patch }
}

const scene = (arrow: OpenDrawLinearElement, patch: Partial<OpenDrawLinearElement>) => {
  const next = { ...arrow, ...patch } as OpenDrawLinearElement
  return next.points.map((p) => ({ x: next.x + p.x, y: next.y + p.y }))
}

/** Every leg runs horizontally or vertically. */
function expectOrthogonal(points: Point[]): void {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    expect(Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6).toBe(true)
  }
}

describe('elbow arrows (Excalidraw elbowArrow.ts)', () => {
  it('routes a loose arrow in orthogonal legs between its tips', () => {
    const route = routeElbow(
      { startArrowhead: null, endArrowhead: 'arrow', startBound: false },
      { start: { x: 0, y: 0 }, end: { x: 200, y: 120 }, startShape: null, endShape: null },
    )
    expect(route[0]).toEqual({ x: 0, y: 0 })
    expect(route[route.length - 1]).toEqual({ x: 200, y: 120 })
    expect(route.length).toBeGreaterThan(2)
    expectOrthogonal(route)
  })

  it('leaves and enters bound shapes square on the facing sides', () => {
    const left = box(0, 0)
    const right = box(300, 150)
    const arrow = elbow({ x: 100, y: 40 }, { x: 300, y: 190 }, {
      startBinding: bindingAt(left, { x: 100 + BASE_BINDING_GAP + 1, y: 40 }, 'orbit'),
      endBinding: bindingAt(right, { x: 300 - BASE_BINDING_GAP - 1, y: 190 }, 'orbit'),
    })
    const points = scene(arrow, elbowRoutePatch(arrow, [left, right, arrow]))
    expectOrthogonal(points)
    const [first, second] = [points[0]!, points[1]!]
    const [beforeLast, last] = [points[points.length - 2]!, points[points.length - 1]!]
    // Out of the left box's right side, horizontally; into the right box's left side.
    expect(first.x).toBeGreaterThan(100)
    expect(second.y).toBeCloseTo(first.y)
    expect(second.x).toBeGreaterThan(first.x)
    expect(last.x).toBeLessThan(300)
    expect(beforeLast.y).toBeCloseTo(last.y)
    expect(beforeLast.x).toBeLessThan(last.x)
  })

  it('goes around when the shapes are stacked: out the bottom, in the top', () => {
    const top = box(0, 0)
    const bottom = box(0, 300)
    const arrow = elbow({ x: 50, y: 80 }, { x: 50, y: 300 }, {
      startBinding: bindingAt(top, elbowSnapPoint(top, { x: 50, y: 90 }, 1), 'orbit'),
      endBinding: bindingAt(bottom, elbowSnapPoint(bottom, { x: 50, y: 290 }, 1), 'orbit'),
    })
    const points = scene(arrow, elbowRoutePatch(arrow, [top, bottom, arrow]))
    expectOrthogonal(points)
    expect(points[0]!.y).toBeGreaterThan(80)
    expect(points[points.length - 1]!.y).toBeLessThan(300)
  })

  it('snaps a tip to the side the pointer nears, one gap out', () => {
    const shape = box(0, 0, 200, 100)
    const snapped = elbowSnapPoint(shape, { x: 140, y: -8 }, 1)
    expect(snapped.x).toBeCloseTo(140, 0)
    expect(snapped.y).toBeLessThan(0)
    expect(snapped.y).toBeGreaterThan(-12)
  })

  it('re-routes when a bound shape moves', () => {
    const left = box(0, 0)
    const right = box(300, 0)
    const arrow = elbow({ x: 100, y: 40 }, { x: 300, y: 40 }, {
      startBinding: bindingAt(left, elbowSnapPoint(left, { x: 110, y: 40 }, 1), 'orbit'),
      endBinding: bindingAt(right, elbowSnapPoint(right, { x: 290, y: 40 }, 1), 'orbit'),
    })
    const moved = { ...right, y: 250 }
    const patch = bindingFollowPatches(new Set([right.id]), [left, moved, arrow] as OpenDrawElement[]).get(arrow.id)!
    const points = scene(arrow, patch)
    expectOrthogonal(points)
    expect(points[points.length - 1]!.y).toBeGreaterThan(250)
  })

  it('draws rounded elbows and survives a file round-trip', () => {
    expect(elbowArrowPath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }])).toContain('Q')
    const arrow = elbow({ x: 0, y: 0 }, { x: 100, y: 80 })
    const file = parseFile({ type: 'opendraw', version: 1, elements: [arrow] })
    expect((file.elements[0] as OpenDrawLinearElement).elbowed).toBe(true)
  })

  it('switching the arrow type to elbow routes the selected arrow, as one undo step', () => {
    const arrow = newLinearElement('arrow', { x: 0, y: 0, points: [{ x: 0, y: 0 }, { x: 160, y: 90 }] }) as OpenDrawLinearElement
    const doc = new OpenDrawDocument({ elements: [arrow] })
    doc.select(arrow.id)
    doc.changeArrowType('elbow')
    const routed = doc.getElement(arrow.id) as OpenDrawLinearElement
    expect(routed.elbowed).toBe(true)
    expect(routed.points.length).toBeGreaterThan(2)
    expectOrthogonal(routed.points)
    doc.undo()
    expect((doc.getElement(arrow.id) as OpenDrawLinearElement).elbowed).toBeFalsy()
  })

  it('never routes a kink: no leg off axis, no short interior jog between separate shapes', () => {
    // A seeded sweep over shape kinds, sizes, placements and drop points.
    // Before the jog cleanup, ~4% of these routes had a 2px step or a leg
    // a fraction of a pixel off axis, drawn as hooks and doubled strokes.
    let seed = 7
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const kinds = [newRectangleElement, newEllipseElement, newDiamondElement]
    for (let i = 0; i < 1500; i++) {
      const size = () => ({ width: 60 + random() * 140, height: 40 + random() * 120 })
      const a = kinds[i % 3]!({ x: 0, y: 0, ...size() })
      const b = newRectangleElement({ x: (random() - 0.5) * 700, y: (random() - 0.5) * 700, ...size() })
      const separate =
        b.x > a.x + a.width + 10 || b.x + b.width < a.x - 10 || b.y > a.y + a.height + 10 || b.y + b.height < a.y - 10
      const from = { x: a.x + random() * a.width, y: a.y + random() * a.height }
      const to = { x: b.x + random() * b.width, y: b.y + random() * b.height }
      const arrow = elbow(from, to, {
        startBinding: bindingAt(a, from, 'orbit'),
        endBinding: bindingAt(b, to, 'orbit'),
      })
      const points = scene(arrow, elbowRoutePatch(arrow, [a, b] as OpenDrawElement[]))
      expectOrthogonal(points)
      // A three-leg route's middle leg is the real offset between the tips: it stays.
      if (separate && points.length > 4) {
        for (let k = 2; k < points.length - 1; k++) {
          const leg = Math.abs(points[k]!.x - points[k - 1]!.x) + Math.abs(points[k]!.y - points[k - 1]!.y)
          expect(leg, `case ${i}, leg ${k}`).toBeGreaterThanOrEqual(8)
        }
      }
    }
  })
})
