import { describe, expect, it } from 'vitest'

import { newLinearElement, newRectangleElement } from '../src/elements/factories.js'
import { alignUnits, distributeUnits, flipElements, selectionUnits } from '../src/elements/arrange.js'
import { getCommonBounds } from '../src/geometry/bounds.js'
import { OpenDrawDocument } from '../src/scene/document.js'
import type { OpenDrawElement, OpenDrawLinearElement } from '../src/types.js'

function rect(x: number, y: number, w = 10, h = 10, groupIds: string[] = []) {
  return newRectangleElement({ x, y, width: w, height: h, groupIds })
}

function apply(elements: OpenDrawElement[], entries: ReturnType<typeof alignUnits>): OpenDrawElement[] {
  const byId = new Map(entries.map((e) => [e.id, e.patch]))
  return elements.map((el) => ({ ...el, ...(byId.get(el.id) ?? {}) }) as OpenDrawElement)
}

describe('arrange, align', () => {
  it('aligns left, center and right edges', () => {
    const a = rect(0, 0, 10)
    const b = rect(50, 30, 30)
    const units = [[a], [b]]
    const left = apply([a, b], alignUnits(units, { axis: 'x', position: 'start' }))
    expect(left.map((el) => el.x)).toEqual([0, 0])
    const right = apply([a, b], alignUnits(units, { axis: 'x', position: 'end' }))
    expect(right.map((el) => el.x + el.width)).toEqual([80, 80])
    const center = apply([a, b], alignUnits(units, { axis: 'x', position: 'center' }))
    expect(center.map((el) => el.x + el.width / 2)).toEqual([40, 40])
  })

  it('moves a selected group as one rigid block', () => {
    const g1 = rect(100, 0, 10, 10, ['g'])
    const g2 = rect(120, 0, 10, 10, ['g'])
    const lone = rect(0, 0)
    const all = [g1, g2, lone]
    const units = selectionUnits(all, all, null)
    expect(units).toHaveLength(2)
    const out = apply(all, alignUnits(units, { axis: 'x', position: 'start' }))
    expect(out[0]!.x).toBe(0)
    expect(out[1]!.x).toBe(20)
  })

  it('aligns the inner members of a lone selected group', () => {
    const g1 = rect(100, 0, 10, 10, ['g'])
    const g2 = rect(120, 40, 10, 10, ['g'])
    const units = selectionUnits([g1, g2], [g1, g2], null)
    expect(units).toHaveLength(2)
  })
})

describe('arrange, distribute', () => {
  it('equalizes the gaps and keeps the outer units fixed', () => {
    const a = rect(0, 0, 10)
    const b = rect(15, 0, 10)
    const c = rect(90, 0, 10)
    const out = apply([a, b, c], distributeUnits([[a], [b], [c]], 'x'))
    expect(out.map((el) => el.x)).toEqual([0, 45, 90])
  })

  it('needs three units', () => {
    expect(distributeUnits([[rect(0, 0)], [rect(50, 0)]], 'x')).toEqual([])
  })
})

describe('arrange, flip', () => {
  it('mirrors boxes across the selection center', () => {
    const a = rect(0, 0, 10)
    const b = rect(90, 0, 10)
    const out = apply([a, b], flipElements([a, b], 'horizontal'))
    expect(out[0]!.x).toBe(90)
    expect(out[1]!.x).toBe(0)
  })

  it('mirrors line points exactly and keeps the bounds', () => {
    const line = newLinearElement('line', {
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      points: [{ x: 0, y: 0 }, { x: 100, y: 50 }],
    }) as OpenDrawLinearElement
    const before = getCommonBounds([line])
    const [flipped] = apply([line], flipElements([line], 'horizontal')) as OpenDrawLinearElement[]
    expect(flipped!.points).toEqual([{ x: 100, y: 0 }, { x: 0, y: 50 }])
    expect(getCommonBounds([flipped!])).toEqual(before)
  })

  it('negates the angle of a rotated element', () => {
    const a = { ...rect(0, 0), angle: 0.5 }
    const [patch] = flipElements([a], 'vertical')
    expect(patch!.patch.angle).toBeCloseTo(Math.PI * 2 - 0.5)
  })
})

describe('arrange, document', () => {
  it('aligns in one undo step and leaves locked elements alone', () => {
    const a = rect(0, 0)
    const b = rect(50, 0)
    const locked = { ...rect(200, 0), locked: true }
    const doc = new OpenDrawDocument({ elements: [a, b, locked] })
    doc.select([a.id, b.id, locked.id])
    doc.alignSelection({ axis: 'x', position: 'end' })
    expect(doc.getElement(a.id)!.x).toBe(50)
    expect(doc.getElement(locked.id)!.x).toBe(200)
    doc.undo()
    expect(doc.getElement(a.id)!.x).toBe(0)
  })
})

describe('styles, copy and paste', async () => {
  const { stylePayloadOf, newTextElement } = await import('../src/elements/factories.js')
  it('pastes onto the selection in one step and leaves defaults alone', () => {
    const source = { ...rect(0, 0), strokeColor: '#e03131', roundness: 'round' as const }
    const target = rect(50, 0)
    const text = newTextElement({ x: 0, y: 40, text: 'hi' })
    const doc = new OpenDrawDocument({ elements: [source, target, text] })
    const payload = stylePayloadOf(source)
    doc.select([target.id, text.id])
    doc.pasteStyle(payload)
    expect(doc.getElement(target.id)!.strokeColor).toBe('#e03131')
    expect((doc.getElement(target.id) as typeof source).roundness).toBe('round')
    expect(doc.getElement(text.id)!.strokeColor).toBe('#e03131')
    doc.undo()
    expect(doc.getElement(target.id)!.strokeColor).toBe('#1e1e1e')
    doc.select(null)
    doc.pasteStyle(payload)
    expect(doc.getAppState().style.strokeColor).toBe('#1e1e1e')
  })
})
