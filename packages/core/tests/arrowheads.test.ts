import { describe, expect, it } from 'vitest'

import { newLinearElement } from '../src/elements/factories.js'
import { parseFile } from '../src/export/serialize.js'
import { arrowheadPoints } from '../src/render/arrowheads.js'
import { VueDrawDocument } from '../src/scene/document.js'
import type { VueDrawLinearElement } from '../src/types.js'

function arrow(points = [{ x: 0, y: 0 }, { x: 100, y: 0 }]) {
  return newLinearElement('arrow', { x: 0, y: 0, points }) as VueDrawLinearElement
}

describe('arrowheads — geometry', () => {
  it('opens an arrow head 20° either side of the shaft, 25px long', () => {
    const [tx, ty, x3, y3, x4, y4] = arrowheadPoints(arrow(), 'end', 'arrow')!
    expect([tx, ty]).toEqual([100, 0])
    const length = Math.hypot(x3! - 100, y3!)
    expect(length).toBeCloseTo(25)
    expect(Math.abs(Math.atan2(y3!, 100 - x3!))).toBeCloseTo((20 * Math.PI) / 180)
    expect(y4).toBeCloseTo(-y3!)
  })

  it('shrinks on short segments so the head never swallows the line', () => {
    const [, , x3] = arrowheadPoints(arrow([{ x: 0, y: 0 }, { x: 20, y: 0 }]), 'end', 'arrow')!
    // Half the 20px segment.
    expect(20 - x3!).toBeCloseTo(10 * Math.cos((20 * Math.PI) / 180))
  })

  it('points the start head back along the first segment', () => {
    const [tx, , x3] = arrowheadPoints(arrow(), 'start', 'triangle')!
    expect(tx).toBe(0)
    expect(x3!).toBeGreaterThan(0)
  })

  it('returns a center and diameter for circles', () => {
    expect(arrowheadPoints(arrow(), 'end', 'circle')).toHaveLength(3)
  })

  it('is null for a zero-length end segment', () => {
    expect(arrowheadPoints(arrow([{ x: 0, y: 0 }, { x: 0, y: 0 }]), 'end', 'arrow')).toBeNull()
  })
})

describe('arrowheads — model', () => {
  it('defaults arrows to an end arrow and lines to none', () => {
    const a = arrow()
    expect([a.startArrowhead, a.endArrowhead]).toEqual([null, 'arrow'])
    const line = newLinearElement('line', { x: 0, y: 0 }) as VueDrawLinearElement
    expect([line.startArrowhead, line.endArrowhead]).toEqual([null, null])
  })

  it('reads older files: arrows without the field keep their end head', () => {
    const { startArrowhead: _s, endArrowhead: _e, ...legacy } = arrow()
    const file = parseFile({ type: 'vuedraw', version: 1, elements: [legacy, { ...arrow(), endArrowhead: null, startArrowhead: 'dot' }] })
    const [old, explicit] = file.elements as VueDrawLinearElement[]
    expect(old!.endArrowhead).toBe('arrow')
    expect(explicit!.endArrowhead).toBeNull()
    expect(explicit!.startArrowhead).toBe('circle')
  })

  it('changes the selected arrows, else the next arrow default', () => {
    const a = arrow()
    const doc = new VueDrawDocument({ elements: [a] })
    doc.changeArrowhead('start', 'triangle')
    expect(doc.getAppState().arrowheads.start).toBe('triangle')
    doc.select(a.id)
    doc.changeArrowhead('end', 'bar')
    expect((doc.getElement(a.id) as VueDrawLinearElement).endArrowhead).toBe('bar')
    doc.undo()
    expect((doc.getElement(a.id) as VueDrawLinearElement).endArrowhead).toBe('arrow')
  })
})
