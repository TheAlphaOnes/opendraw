/**
 * SVG export tests, `exportToSvg` is pure string building, so these run
 * without a DOM. The assertions pin the structural contract an SVG consumer
 * (browser, design tool, file preview) depends on: a standalone document,
 * viewBox sized to content, vector paths for rough shapes, filled paths for
 * freedraw, and real text nodes for text.
 */

import { describe, expect, it } from 'vitest'

import { STROKE_PALETTE } from '../src/elements/defaults.js'
import {
  newFreedrawElement,
  newLinearElement,
  newRectangleElement,
  newTextElement,
} from '../src/elements/factories.js'
import { exportToSvg } from '../src/export/svg.js'

const BACKGROUND = '#ffffff'
const PADDING = 20

describe('exportToSvg', () => {
  it('produces a standalone svg document sized to the content bounds', () => {
    const element = newRectangleElement({ x: 100, y: 50, width: 200, height: 100 })
    const svg = exportToSvg([element], BACKGROUND)

    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    // Content spans x:100..300, y:50..150, padding extends each side by 20.
    expect(svg).toContain('viewBox="80 30 240 140"')
    expect(svg).toContain('width="240"')
    expect(svg).toContain('height="140"')
  })

  it('paints the canvas background as a rect, unless transparent', () => {
    const element = newRectangleElement({ x: 0, y: 0, width: 10, height: 10 })
    expect(exportToSvg([element], BACKGROUND)).toContain(`<rect`)
    expect(exportToSvg([element], BACKGROUND)).toContain(`fill="${BACKGROUND}"`)

    const transparent = exportToSvg([element], BACKGROUND, { background: 'transparent' })
    expect(transparent).not.toContain('<rect')
  })

  it('serializes rough shapes as stroke paths carrying the element transform', () => {
    const element = newRectangleElement({
      x: 10,
      y: 10,
      width: 40,
      height: 30,
      style: { strokeColor: STROKE_PALETTE[1]!, backgroundColor: 'transparent' },
    })
    const svg = exportToSvg([element], BACKGROUND)

    expect(svg).toContain(`<g transform="translate(10 10)">`)
    expect(svg).toContain('<path d="M ')
    expect(svg).toContain(`stroke="${STROKE_PALETTE[1]}"`)
    expect(svg).toContain('stroke-linecap="round"')
  })

  it('emits a fill path with the stroke color for freedraw', () => {
    const element = newFreedrawElement({
      x: 0,
      y: 0,
      style: { strokeColor: '#1e1e1e' },
      points: [
        [0, 0, 0.5],
        [10, 5, 0.5],
        [25, 12, 0.5],
      ],
    })
    const svg = exportToSvg([element], BACKGROUND)

    expect(svg).toContain('<path d="M ')
    expect(svg).toContain('fill="#1e1e1e"')
    expect(svg).toContain(' Z"') // closed outline
  })

  it('renders text elements as escaped text nodes with the font stack and anchor', () => {
    const element = newTextElement({ x: 5, y: 5, text: 'hello <world>' })
    const svg = exportToSvg([element], BACKGROUND)

    // Angle brackets must be XML-escaped, not pasted raw into the markup.
    expect(svg).toContain('>hello ' + '&' + 'lt;world' + '&' + 'gt;</text>')
    expect(svg).not.toContain('>hello <world></text>')
    expect(svg).toContain('font-size="20"')
    expect(svg).toContain('font-family=')
    expect(svg).toContain('text-anchor="start"')
  })

  it('bakes dark-theme filtered colors into the output', () => {
    const element = newRectangleElement({
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      style: { strokeColor: '#1e1e1e', backgroundColor: 'transparent' },
    })
    const light = exportToSvg([element], BACKGROUND, { theme: 'light' })
    const dark = exportToSvg([element], BACKGROUND, { theme: 'dark' })

    expect(light).toContain('stroke="#1e1e1e"')
    expect(dark).not.toContain('stroke="#1e1e1e"')
    // The dark theme maps the default ink to a light gray.
    expect(dark).toContain('stroke="#d3d3d3"')
  })

  it('emits dashed stroke attributes for dashed stroke styles', () => {
    const element = newLinearElement('line', {
      x: 0,
      y: 0,
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
      ],
      style: { strokeStyle: 'dashed' },
    })
    const svg = exportToSvg([element], BACKGROUND)

    expect(svg).toContain('stroke-dasharray="')
  })

  it('falls back to a padded empty canvas for an empty scene', () => {
    const svg = exportToSvg([], BACKGROUND)
    expect(svg).toContain(`viewBox="-20 -20 40 40"`)
    expect(svg).toContain(`width="40"`)
  })
})
