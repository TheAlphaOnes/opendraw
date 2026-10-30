import { describe, expect, it } from 'vitest'

import { LaserStroke, svgPathFromOutline } from '../src/canvas/laserOutline.js'

const stroke = (scale: () => number) =>
  new LaserStroke({ size: 2, streamline: 0.4, keepHead: false, sizeMapping: scale })

describe('laser outline (Excalidraw laser-pointer port)', () => {
  it('outlines a stroke as one closed path', () => {
    const s = stroke(() => 1)
    for (let i = 0; i < 20; i++) {
      s.addPoint([i * 10, Math.sin(i) * 20, i])
    }
    const outline = s.getStrokeOutline()
    expect(outline.length).toBeGreaterThan(20)
    expect(outline[0]).toEqual(outline[outline.length - 1])
    const path = svgPathFromOutline(outline)
    expect(path.startsWith('M')).toBe(true)
    expect(path.endsWith('Z')).toBe(true)
  })

  it('vanishes once the size mapping has decayed to zero', () => {
    const s = stroke(() => 0)
    for (let i = 0; i < 10; i++) {
      s.addPoint([i * 10, 0, i])
    }
    expect(s.getStrokeOutline()).toEqual([])
  })

  it('skips repeated points', () => {
    const s = stroke(() => 1)
    s.addPoint([0, 0, 0])
    s.addPoint([0, 0, 1])
    expect(s.originalPoints).toHaveLength(1)
  })
})
