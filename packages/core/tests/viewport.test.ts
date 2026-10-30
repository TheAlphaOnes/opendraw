import { describe, expect, it } from 'vitest'

import { fitViewportToBounds, sceneToScreen } from '../src/viewport.js'

describe('viewport — fit to bounds', () => {
  it('centers and scales down without zooming past 100%', () => {
    const vp = fitViewportToBounds(
      { scrollX: 0, scrollY: 0, zoom: 2 },
      { x1: 0, y1: 0, x2: 100, y2: 100 },
      { size: { width: 800, height: 600 }, fit: 'scale-down' },
    )
    expect(vp.zoom).toBe(1)
    expect(sceneToScreen({ x: 50, y: 50 }, vp)).toEqual({ x: 400, y: 300 })
  })

  it('contain fills the canvas at any zoom', () => {
    const vp = fitViewportToBounds(
      { scrollX: 0, scrollY: 0, zoom: 1 },
      { x1: 0, y1: 0, x2: 100, y2: 50 },
      { size: { width: 800, height: 600 }, fit: 'contain' },
    )
    expect(vp.zoom).toBe(8)
  })

  it('keeps the viewport when there is nothing to fit', () => {
    const vp = { scrollX: 3, scrollY: 4, zoom: 1.5 }
    const empty = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity }
    expect(fitViewportToBounds(vp, empty, { size: { width: 800, height: 600 }, fit: 'contain' })).toBe(vp)
  })
})
