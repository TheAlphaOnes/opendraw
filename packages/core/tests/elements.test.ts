import { describe, expect, it } from 'vitest'

import {
  DEFAULT_ELEMENT_STYLE,
  BACKGROUND_PALETTE,
  FONT_STACKS,
  STROKE_PALETTE,
} from '../src/elements/defaults.js'
import {
  duplicateElement,
  isElementType,
  newDiamondElement,
  newEllipseElement,
  newTextElement,
  newFreedrawElement,
  newLinearElement,
  newRectangleElement,
} from '../src/elements/factories.js'
import { forcePatchElement, patchElement } from '../src/elements/mutate.js'
import { layoutText } from '../src/geometry/text.js'

describe('defaults', () => {
  it('ships excalidraw-compatible default style', () => {
    expect(DEFAULT_ELEMENT_STYLE).toMatchObject({
      strokeColor: '#1e1e1e',
      backgroundColor: 'transparent',
      fillStyle: 'hachure',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 1,
      opacity: 100,
    })
  })

  it('palettes contain only colors and transparent', () => {
    expect(STROKE_PALETTE).toContain('#1e1e1e')
    expect(BACKGROUND_PALETTE[0]).toBe('transparent')
    expect(BACKGROUND_PALETTE.length).toBeGreaterThan(3)
  })

  it('declares font stacks for all three families', () => {
    for (const stack of Object.values(FONT_STACKS)) {
      expect(stack.length).toBeGreaterThan(0)
    }
  })
})

describe('factories', () => {
  it('creates a rectangle with defaults', () => {
    const el = newRectangleElement({ x: 10, y: 20, width: 100, height: 50 })
    expect(el.type).toBe('rectangle')
    expect(el.x).toBe(10)
    expect(el.y).toBe(20)
    expect(el.width).toBe(100)
    expect(el.height).toBe(50)
    expect(el.version).toBe(1)
    expect(el.seed).toBeGreaterThan(0)
    expect(el.id).toBeTruthy()
    expect(el.locked).toBe(false)
    expect({ ...el }).toMatchObject(DEFAULT_ELEMENT_STYLE)
  })

  it('lets style overrides win over defaults', () => {
    const el = newRectangleElement({
      x: 0,
      y: 0,
      style: { strokeColor: '#e03131', strokeWidth: 4 },
    })
    expect(el.strokeColor).toBe('#e03131')
    expect(el.strokeWidth).toBe(4)
    expect(el.fillStyle).toBe('hachure')
  })

  it('accepts a deterministic id and seed', () => {
    const el = newRectangleElement({ x: 0, y: 0, id: 'fixed', seed: 42 })
    expect(el.id).toBe('fixed')
    expect(el.seed).toBe(42)
  })

  it('creates linear elements with an initial local point', () => {
    const line = newLinearElement('line', { x: 0, y: 0 })
    expect(line.type).toBe('line')
    expect(line.points).toEqual([{ x: 0, y: 0 }])
    const arrow = newLinearElement('arrow', { x: 5, y: 5, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] })
    expect(arrow.points).toHaveLength(2)
  })

  it('creates freedraw elements with pressure points', () => {
    const el = newFreedrawElement({
      x: 0,
      y: 0,
      points: [[0, 0, 0.5], [10, 10, 0.7]],
      simulatePressure: false,
    })
    expect(el.type).toBe('freedraw')
    expect(el.points).toHaveLength(2)
    expect(el.simulatePressure).toBe(false)
  })

  it('measures text elements for width and height', () => {
    const layout = layoutText('hello', 'normal', 20)
    const el = newTextElement({ x: 0, y: 0, text: 'hello', layout })
    expect(el.type).toBe('text')
    expect(el.fontSize).toBe(20)
    expect(el.width).toBe(layout.width)
    expect(el.height).toBeCloseTo(25, 5) // 1 line * 20px * 1.25 line height
  })

  it('measures multi-line text height by line count', () => {
    const layout = layoutText('a\nb\nc', 'normal', 20)
    expect(layout.lines).toEqual(['a', 'b', 'c'])
    expect(layout.height).toBeCloseTo(75, 5)
  })

  it('duplicates with a new identity but the same look', () => {
    const el = newRectangleElement({ x: 10, y: 10, width: 5, height: 5 })
    const copy = duplicateElement(el, { x: 20, y: 20 })
    expect(copy.id).not.toBe(el.id)
    expect(copy.seed).toBe(el.seed) // identical hand-drawn jitter
    expect(copy.x).toBe(20)
    expect(copy.version).toBe(1)
  })

  it('validates element types', () => {
    expect(isElementType('rectangle')).toBe(true)
    expect(isElementType('nonsense')).toBe(false)
  })
})

describe('patchElement (copy-on-write)', () => {
  it('returns the same reference for a no-op patch', () => {
    const el = newRectangleElement({ x: 0, y: 0, width: 10, height: 10 })
    const patched = patchElement(el, { x: 0, strokeColor: el.strokeColor })
    expect(patched).toBe(el)
  })

  it('bumps version and nonce on a real patch', () => {
    const el = newRectangleElement({ x: 0, y: 0, width: 10, height: 10 })
    const patched = patchElement(el, { x: 5 })
    expect(patched).not.toBe(el)
    expect(patched.x).toBe(5)
    expect(patched.version).toBe(el.version + 1)
    expect(patched.versionNonce).not.toBe(el.versionNonce)
  })

  it('forcePatchElement always creates a new version', () => {
    const el = newRectangleElement({ x: 0, y: 0 })
    const patched = forcePatchElement(el, { x: 0 })
    expect(patched).not.toBe(el)
    expect(patched.version).toBe(el.version + 1)
  })
})

describe('corner roundness', () => {
  it('defaults rectangles and diamonds to sharp corners', () => {
    expect(newRectangleElement({ x: 0, y: 0, width: 10, height: 10 }).roundness).toBeNull()
    expect(newDiamondElement({ x: 0, y: 0, width: 10, height: 10 }).roundness).toBeNull()
  })

  it('passes an explicit rounded corner through to shapes', () => {
    expect(
      newRectangleElement({ x: 0, y: 0, width: 10, height: 10, roundness: 'round' }).roundness,
    ).toBe('round')
    expect(
      newDiamondElement({ x: 0, y: 0, width: 10, height: 10, roundness: 'round' }).roundness,
    ).toBe('round')
  })

  it('leaves the roundness-less ellipse untouched', () => {
    const el = newEllipseElement({ x: 0, y: 0, width: 10, height: 10, roundness: 'round' })
    expect('roundness' in el).toBe(false)
  })
})
