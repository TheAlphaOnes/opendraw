import { describe, expect, it } from 'vitest'

import {
  buildFile,
  coerceElement,
  parseFile,
  parseFromJSON,
  serializeToJSON,
} from '../src/export/serialize.js'
import {
  newFreedrawElement,
  isFreedrawElement,
  isLinearElement,
  isTextElement,
  newLinearElement,
  newRectangleElement,
  newTextElement,
} from '../src/elements/factories.js'
import type { OpenDrawDiamondElement, OpenDrawRectangleElement } from '../src/types.js'

describe('coerceElement', () => {
  it('rejects non-elements', () => {
    expect(coerceElement(null)).toBeNull()
    expect(coerceElement(undefined)).toBeNull()
    expect(coerceElement(42)).toBeNull()
    expect(coerceElement({})).toBeNull()
    expect(coerceElement({ id: 'x', type: 'nonsense', x: 0, y: 0 })).toBeNull()
  })

  it('accepts a valid rectangle as-is', () => {
    const el = newRectangleElement({ x: 5, y: 6, width: 30, height: 20 })
    const coerced = coerceElement(JSON.parse(JSON.stringify(el)))
    expect(coerced).toEqual(el)
  })

  it('fills defaults for missing optional props', () => {
    const coerced = coerceElement({ id: 'a', type: 'rectangle', x: 0, y: 0 })
    expect(coerced).toMatchObject({
      strokeWidth: 2,
      roughness: 1,
      opacity: 100,
      fillStyle: 'hachure',
      strokeStyle: 'solid',
      locked: false,
    })
  })

  it('falls back on invalid style values', () => {
    const coerced = coerceElement({
      id: 'a',
      type: 'rectangle',
      x: 0,
      y: 0,
      strokeWidth: 3,
      fillStyle: 'glitter',
      opacity: 500,
    })
    expect(coerced!.strokeWidth).toBe(2)
    expect(coerced!.fillStyle).toBe('hachure')
    expect(coerced!.opacity).toBe(100)
  })

  it('coerces linear and freedraw points', () => {
    const line = coerceElement({
      id: 'l',
      type: 'arrow',
      x: 1,
      y: 2,
      points: [{ x: 0, y: 0 }, 'junk', { x: 9, y: 9 }],
    })
    expect(line?.type).toBe('arrow')
    expect(line && isLinearElement(line) ? line.points : null).toHaveLength(2)

    const freedraw = coerceElement({
      id: 'f',
      type: 'freedraw',
      x: 0,
      y: 0,
      points: [[0, 0, 0.4], [10, 10]],
    })
    if (!freedraw || !isFreedrawElement(freedraw)) {
      throw new Error('expected a freedraw element')
    }
    expect(freedraw.points).toEqual([
      [0, 0, 0.4],
      [10, 10, 0.5],
    ])
    expect(freedraw.simulatePressure).toBe(true)
  })

  it('coerces text fields', () => {
    const text = coerceElement({
      id: 't',
      type: 'text',
      x: 0,
      y: 0,
      text: 'hello',
      fontSize: -50,
      textAlign: 'justify',
    })
    if (!text || !isTextElement(text)) {
      throw new Error('expected a text element')
    }
    expect(text.fontSize).toBe(8)
    expect(text.textAlign).toBe('left')
    expect(text.text).toBe('hello')
  })
})

describe('file format', () => {
  it('builds and parses a file round-trip', () => {
    const elements = [
      newRectangleElement({ x: 0, y: 0, width: 10, height: 10 }),
      newLinearElement('line', { x: 1, y: 1, points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] }),
      newTextElement({ x: 2, y: 2, text: 'label' }),
      newFreedrawElement({ x: 3, y: 3, points: [[0, 0, 0.5], [1, 1, 0.5]] }),
    ]
    const file = buildFile(elements, '#f8f9fa')
    const parsed = parseFromJSON(serializeToJSON(file))
    expect(parsed.type).toBe('opendraw')
    expect(parsed.version).toBe(1)
    expect(parsed.appState.viewBackgroundColor).toBe('#f8f9fa')
    expect(parsed.elements).toEqual(elements)
  })

  it('throws for foreign payloads', () => {
    expect(() => parseFile({ type: 'figma' })).toThrow(/not an opendraw file/)
    expect(() => parseFile('opendraw')).toThrow()
  })

  it('reads files saved before the opendraw rename and writes the new type', () => {
    const rect = newRectangleElement({ x: 0, y: 0, width: 5, height: 5 })
    const file = parseFile({ type: 'vuedraw', version: 1, elements: [rect] })
    expect(file.type).toBe('opendraw')
    expect(file.elements).toHaveLength(1)
  })

  it('drops malformed elements instead of failing the whole file', () => {
    const good = newRectangleElement({ x: 0, y: 0, width: 5, height: 5 })
    const file = parseFile({
      type: 'opendraw',
      version: 1,
      elements: [good, { garbage: true }, null, { id: 'x', type: 'nope' }],
      appState: {},
    })
    expect(file.elements.map((el) => el.id)).toEqual([good.id])
  })

  it('survives a missing appState', () => {
    const file = parseFile({ type: 'opendraw', version: 1, elements: [] })
    expect(file.appState.viewBackgroundColor).toBe('#ffffff')
  })
})

describe('corner roundness', () => {
  it('round-trips rounded rectangles and diamonds', () => {
    const round = coerceElement({
      id: 'r1',
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      roundness: 'round',
    })
    expect(round).not.toBeNull()
    expect((round as OpenDrawRectangleElement).roundness).toBe('round')

    const diamond = coerceElement({
      id: 'd1',
      type: 'diamond',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      roundness: 'round',
    })
    expect((diamond as OpenDrawDiamondElement).roundness).toBe('round')
  })

  it('coerces unknown roundness values back to sharp', () => {
    const el = coerceElement({
      id: 'r2',
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      roundness: 'wavy',
    })
    expect((el as OpenDrawRectangleElement).roundness).toBeNull()
  })

  it('keeps roundness off the ellipse, which is round by nature', () => {
    const el = coerceElement({
      id: 'e1',
      type: 'ellipse',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      roundness: 'round',
    })
    expect('roundness' in el!).toBe(false)
  })
})
