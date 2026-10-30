/**
 * Image & frame element tests — the pure halves of image support: factories,
 * defensive serialization, box-like geometry (bounds + hit testing) and the
 * self-contained SVG embedding. Decoding is browser-side and lives in the
 * nuxt layer; everything here must run without a DOM.
 */

import { describe, expect, it } from 'vitest'

import { getElementBounds } from '../src/geometry/bounds.js'
import {
  isFrameElement,
  isImageElement,
  newFrameElement,
  newImageElement,
} from '../src/elements/factories.js'
import { hitTestElement } from '../src/elements/hitTest.js'
import { buildFile, coerceElement, parseFile } from '../src/export/serialize.js'
import { exportToSvg } from '../src/export/svg.js'
import type { OpenDrawFrameElement, OpenDrawImageElement } from '../src/types.js'

const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('newImageElement', () => {
  it('creates a box-like image carrying its data URL', () => {
    const image = newImageElement({ x: 10, y: 20, width: 40, height: 30, dataUrl: PNG_DATA_URL })
    expect(image.type).toBe('image')
    expect(image.dataUrl).toBe(PNG_DATA_URL)
    expect(isImageElement(image)).toBe(true)
    expect(isImageElement({ ...image, type: 'rectangle' })).toBe(false)
  })

  it('rejects non-data-image URLs and degenerate sizes', () => {
    expect(() =>
      newImageElement({ x: 0, y: 0, width: 10, height: 10, dataUrl: 'https://example.com/a.png' }),
    ).toThrow(/data: image URL/)
    expect(() =>
      newImageElement({ x: 0, y: 0, width: 0, height: 10, dataUrl: PNG_DATA_URL }),
    ).toThrow(/positive/)
  })
})

describe('image serialization', () => {
  it('round-trips through the file format', () => {
    const image = newImageElement({ x: 5, y: 6, width: 40, height: 30, dataUrl: PNG_DATA_URL })
    const file = parseFile(JSON.parse(JSON.stringify(buildFile([image], '#ffffff'))))
    const restored = file.elements[0] as OpenDrawImageElement | undefined
    expect(restored).toBeDefined()
    expect(restored?.type).toBe('image')
    expect(restored?.dataUrl).toBe(PNG_DATA_URL)
    expect(restored?.width).toBe(40)
    expect(restored?.height).toBe(30)
  })

  it('coerces a broken data URL to an empty placeholder payload', () => {
    const coerced = coerceElement({
      id: 'a',
      type: 'image',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      dataUrl: 'https://example.com/not-embeddable.png',
    }) as OpenDrawImageElement | null
    expect(coerced).not.toBeNull()
    // An empty dataUrl renders the placeholder — never a broken canvas.
    expect(coerced?.dataUrl).toBe('')
  })

  it('drops foreign payloads that are not elements', () => {
    expect(coerceElement({ id: 'a', type: 'image' })).not.toBeNull()
    expect(coerceElement({ type: 'image', dataUrl: PNG_DATA_URL })).toBeNull()
  })
})

describe('frame serialization', () => {
  it('round-trips and defaults the name', () => {
    const frame = newFrameElement({ x: 0, y: 0, width: 100, height: 80, name: 'Diagram' })
    expect(isFrameElement(frame)).toBe(true)
    const file = parseFile(JSON.parse(JSON.stringify(buildFile([frame], '#ffffff'))))
    const restored = file.elements[0] as OpenDrawFrameElement | undefined
    expect(restored?.name).toBe('Diagram')

    const unnamed = coerceElement({ id: 'f', type: 'frame', x: 0, y: 0, width: 1, height: 1 })
    expect((unnamed as OpenDrawFrameElement | null)?.name).toBe('Frame')
  })
})

describe('image & frame geometry', () => {
  const image = newImageElement({ x: 100, y: 100, width: 40, height: 30, dataUrl: PNG_DATA_URL })
  const frame = newFrameElement({ x: 0, y: 0, width: 200, height: 150 })

  it('bounds cover the scene rect', () => {
    expect(getElementBounds(image)).toEqual({ x1: 100, y1: 100, x2: 140, y2: 130 })
    expect(getElementBounds(frame)).toEqual({ x1: 0, y1: 0, x2: 200, y2: 150 })
  })

  it('hit-tests like a filled box: inside counts, near misses do not', () => {
    expect(hitTestElement(image, { x: 120, y: 115 }, 5)).toBe(true)
    expect(hitTestElement(image, { x: 200, y: 200 }, 5)).toBe(false)
    expect(hitTestElement(frame, { x: 10, y: 10 }, 5)).toBe(true)
    // Outline hits stay within the threshold, box-like.
    expect(hitTestElement(frame, { x: 205, y: 75 }, 5)).toBe(true)
    expect(hitTestElement(frame, { x: 215, y: 75 }, 5)).toBe(false)
  })
})

describe('image & frame SVG export', () => {
  it('embeds the image data so the file stays self-contained', () => {
    const image = newImageElement({ x: 0, y: 0, width: 40, height: 30, dataUrl: PNG_DATA_URL })
    const svg = exportToSvg([image], '#ffffff')
    expect(svg).toContain('<image href="data:image/png;base64,')
    expect(svg).toContain('width="40" height="30"')
  })

  it('renders frames as a dashed rect with the name label', () => {
    const frame = newFrameElement({ x: 0, y: 0, width: 120, height: 90, name: 'Group' })
    const svg = exportToSvg([frame], '#ffffff')
    expect(svg).toContain('stroke-dasharray="8 6"')
    expect(svg).toContain('>Group</text>')
  })
})
