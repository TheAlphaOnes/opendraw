/**
 * Renderer unit tests, pure functions only, no canvas required.
 *
 * The dark-mode filter values below are pinned to the implementation on
 * purpose: they encode the `invert(93%) hue-rotate(180deg)` contract, and
 * a silent change to the color math should turn this suite red.
 */

import { describe, expect, it } from 'vitest'
import { STROKE_PALETTE } from '../src/elements/defaults.js'
import {
  newEllipseElement,
  newLinearElement,
  newRectangleElement,
} from '../src/elements/factories.js'
import {
  adjustRoughness,
  getDashArrayDashed,
  getDashArrayDotted,
  renderableElements,
} from '../src/render/renderScene.js'
import { themeColor } from '../src/render/theme.js'

describe('themeColor', () => {
  it('passes colors through unchanged in light mode', () => {
    expect(themeColor('#1e1e1e', false)).toBe('#1e1e1e')
    expect(themeColor('#ffc9c9', false)).toBe('#ffc9c9')
    expect(themeColor('rgb(30, 30, 30)', false)).toBe('rgb(30, 30, 30)')
  })

  it('keeps transparent as-is in both themes', () => {
    expect(themeColor('transparent', false)).toBe('transparent')
    expect(themeColor('transparent', true)).toBe('transparent')
  })

  it('returns unparseable colors unchanged in dark mode', () => {
    expect(themeColor('var(--ink)', true)).toBe('var(--ink)')
    expect(themeColor('rebeccapurple', true)).toBe('rebeccapurple')
  })

  it('maps white to the near-black dark canvas ink', () => {
    const result = themeColor('#ffffff', true)
    expect(result).toBe('#121212')
    expect(result).not.toBe('#ffffff')
  })

  it('maps the default ink to a light gray', () => {
    const result = themeColor('#1e1e1e', true)
    expect(result).toBe('#d3d3d3')
    expect(result).not.toBe('#1e1e1e')
  })

  it('filters colored strokes to their dark complements', () => {
    const result = themeColor('#e03131', true)
    expect(result).toBe('#ff8383')
    expect(result).not.toBe('#e03131')
  })

  it('expands short hex before filtering', () => {
    expect(themeColor('#fff', true)).toBe(themeColor('#ffffff', true))
  })

  it('parses rgb() strings identically to hex', () => {
    expect(themeColor('rgb(30, 30, 30)', true)).toBe(themeColor('#1e1e1e', true))
    expect(themeColor('rgb(255 255 255)', true)).toBe(themeColor('#ffffff', true))
  })

  it('preserves alpha while filtering the channels', () => {
    expect(themeColor('rgba(30, 30, 30, 0.5)', true)).toBe('rgba(211, 211, 211, 0.5)')
  })

  it('maps every stroke palette swatch to a distinct dark hex', () => {
    for (const color of STROKE_PALETTE) {
      const dark = themeColor(color, true)
      expect(dark).toMatch(/^#[0-9a-f]{6}$/)
      expect(dark).not.toBe(color)
    }
  })
})

describe('getDashArrayDashed', () => {
  it('scales the gap with stroke width', () => {
    expect(getDashArrayDashed(1)).toEqual([8, 9])
    expect(getDashArrayDashed(2)).toEqual([8, 10])
    expect(getDashArrayDashed(4)).toEqual([8, 12])
  })
})

describe('getDashArrayDotted', () => {
  it('scales the gap with stroke width', () => {
    expect(getDashArrayDotted(1)).toEqual([1.5, 7])
    expect(getDashArrayDotted(2)).toEqual([1.5, 8])
    expect(getDashArrayDotted(4)).toEqual([1.5, 10])
  })
})

describe('adjustRoughness', () => {
  it('keeps roughness on large elements', () => {
    const large = newRectangleElement({ x: 0, y: 0, width: 200, height: 100 })
    expect(adjustRoughness(large)).toBe(1)
  })

  it('keeps roughness on medium closed shapes', () => {
    const rect = newRectangleElement({ x: 0, y: 0, width: 30, height: 30 })
    expect(adjustRoughness(rect)).toBe(1)
    const ellipse = newEllipseElement({
      x: 0,
      y: 0,
      width: 16,
      height: 16,
      style: { roughness: 2 },
    })
    expect(adjustRoughness(ellipse)).toBe(2)
  })

  it('halves roughness on small elements', () => {
    const small = newRectangleElement({ x: 0, y: 0, width: 10, height: 10 })
    expect(adjustRoughness(small)).toBe(0.5)
  })

  it('thirds roughness on tiny elements', () => {
    const tiny = newRectangleElement({ x: 0, y: 0, width: 5, height: 5 })
    expect(adjustRoughness(tiny)).toBeCloseTo(1 / 3)
  })

  it('never inflates zero roughness', () => {
    const architect = newRectangleElement({
      x: 0,
      y: 0,
      width: 5,
      height: 5,
      style: { roughness: 0 },
    })
    expect(adjustRoughness(architect)).toBe(0)
  })

  it('measures linear elements from their points, not width/height', () => {
    const long = newLinearElement('line', {
      x: 0,
      y: 0,
      points: [
        { x: 0, y: 0 },
        { x: 120, y: 0 },
      ],
    })
    expect(adjustRoughness(long)).toBe(1)
    const short = newLinearElement('line', {
      x: 0,
      y: 0,
      points: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
      ],
    })
    expect(adjustRoughness(short)).toBeCloseTo(1 / 3)
  })
})

describe('renderableElements', () => {
  it('passes every element through when nothing is being edited', () => {
    const a = newRectangleElement({ x: 0, y: 0, width: 10, height: 10 })
    const b = newRectangleElement({ x: 20, y: 20, width: 10, height: 10 })
    expect(renderableElements([a, b], null)).toEqual([a, b])
  })

  it('drops only the element being edited', () => {
    const a = newRectangleElement({ id: 'a', x: 0, y: 0, width: 10, height: 10 })
    const b = newRectangleElement({ id: 'b', x: 20, y: 20, width: 10, height: 10 })
    expect(renderableElements([a, b], 'a')).toEqual([b])
    expect(renderableElements([a, b], 'missing')).toEqual([a, b])
  })
})
