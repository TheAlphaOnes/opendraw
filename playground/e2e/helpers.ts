import { test as base, expect, type Page } from '@playwright/test'

/**
 * Shared e2e toolkit: document state through the public change/select
 * events (mirrored onto `window.__vuedraw` by the playground page), pointer
 * helpers, and canvas pixel probes.
 */

// ---------------------------------------------------------------------------
// Document mirror
// ---------------------------------------------------------------------------

/** One element as seen through the change event (subset of fields specs use). */
export interface MirroredElement {
  id: string
  type: string
  x: number
  y: number
  width?: number
  height?: number
  points?: Array<{ x: number; y: number }>
  startBinding?: { elementId: string } | null
  endBinding?: { elementId: string } | null
  roundness?: 'round' | null
  text?: string
  [key: string]: unknown
}

export interface MirroredScene {
  elements: MirroredElement[]
  selection: string[]
}

declare global {
  interface Window {
    __vuedraw?: MirroredScene
  }
}

/** Latest mirrored state; empty before the first event lands. */
export async function scene(page: Page): Promise<MirroredScene> {
  return page.evaluate(() => window.__vuedraw ?? { elements: [], selection: [] })
}

/** Scene-space position of an arrow/line tip. */
export function tipOf(element: MirroredElement, which: 'start' | 'end'): { x: number; y: number } {
  const points = element.points ?? []
  const point = (which === 'start' ? points[0] : points[points.length - 1]) ?? { x: 0, y: 0 }
  return { x: element.x + point.x, y: element.y + point.y }
}

// ---------------------------------------------------------------------------
// Extended test: every spec fails on browser console errors or page errors.
// A torn render loop (the HMR-teardown failure mode) announces itself here.
// ---------------------------------------------------------------------------

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(`console: ${message.text()}`)
      }
    })
    await use(page)
    expect(errors, 'browser console must stay clean').toEqual([])
  },
})

export { expect }

// ---------------------------------------------------------------------------
// Pointer + canvas helpers
// ---------------------------------------------------------------------------

export async function openEditor(page: Page): Promise<void> {
  await openApp(page, '/')
}

/** Open a playground page and wait for hydration, not just SSR HTML.
 *
 * The server-rendered DOM is complete before Vue attaches its event
 * handlers, so tool clicks that land earlier are silently swallowed.
 * The mounted app sizes its canvases (SSR ships them at the 300x150
 * canvas default) — that is the hydration signal we wait for.
 */
export async function openApp(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await page.locator('.vuedraw-canvas').waitFor({ state: 'visible' })
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.vuedraw-canvas__static')
    return canvas !== null && canvas.width > 300
  })
}

/** Viewport box of the canvas host; all drawing helpers are relative to it. */
export async function canvasBox(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('.vuedraw-canvas').boundingBox()
  if (!box) {
    throw new Error('vuedraw canvas did not mount')
  }
  return box
}

/** Canvas-local point -> viewport coordinates for the mouse API. */
export function at(
  box: { x: number; y: number },
  x: number,
  y: number,
): { x: number; y: number } {
  return { x: box.x + x, y: box.y + y }
}

/** Click a tool in the dock by its accessible label (e.g. 'Rectangle (2)'). */
export async function pickTool(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: label }).click()
}

/**
 * Give newly drawn shapes an opaque fill. Unfilled shapes only hit-test on
 * their outline, and the binding/grab specs press the interior — the fill
 * makes shapes behave like the filled ones binding demos use.
 */
export async function pickFill(page: Page): Promise<void> {
  await page.getByRole('radio', { name: '#ffc9c9' }).check()
}

export async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 8,
): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps })
  await page.mouse.up()
}

/** Renders are rAF-coalesced: pixel probes must run after frames settle. */
export async function settleFrames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

/** Count of non-transparent pixels on one of the two canvases. */
export async function nonTransparentPixels(page: Page, canvasClass: string): Promise<number> {
  return page.evaluate((className) => {
    const canvas = document.querySelector<HTMLCanvasElement>(`canvas.${className}`)
    if (!canvas) {
      throw new Error(`${className} canvas missing`)
    }
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('2d context unavailable')
    }
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    let count = 0
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]! !== 0) {
        count++
      }
    }
    return count
  }, canvasClass)
}

/** Solid color at a canvas-local point, as [r, g, b]. */
export async function pixelAt(
  page: Page,
  x: number,
  y: number,
): Promise<[number, number, number]> {
  return page.evaluate(
    ({ x, y }) => {
      const canvas = document.querySelector<HTMLCanvasElement>('canvas.vuedraw-canvas__static')
      if (!canvas) {
        throw new Error('static canvas missing')
      }
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('2d context unavailable')
      }
      const scaleX = canvas.width / canvas.clientWidth
      const scaleY = canvas.height / canvas.clientHeight
      const { data } = context.getImageData(
        Math.floor(x * scaleX),
        Math.floor(y * scaleY),
        1,
        1,
      )
      return [data[0]!, data[1]!, data[2]!]
    },
    { x, y },
  )
}

// ---------------------------------------------------------------------------
// Positional ink probes — for asserting WHERE the canvases drew, not just
// that they drew (binding highlight, selection frame, corner geometry).
// ---------------------------------------------------------------------------

/** RGBA at a canvas-local point on the overlay canvas (chrome + previews). */
export async function overlayPixelAt(
  page: Page,
  x: number,
  y: number,
): Promise<[number, number, number, number]> {
  return page.evaluate(
    ({ x, y }) => {
      const canvas = document.querySelector<HTMLCanvasElement>('canvas.vuedraw-canvas__overlay')
      if (!canvas) {
        throw new Error('overlay canvas missing')
      }
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('2d context unavailable')
      }
      const scale = canvas.width / canvas.clientWidth
      const { data } = context.getImageData(
        Math.floor(x * scale),
        Math.floor(y * scale),
        1,
        1,
      )
      return [data[0]!, data[1]!, data[2]!, data[3]!]
    },
    { x, y },
  )
}

/** Count ink pixels in a canvas-local window of the static canvas.
 *
 * "Ink" is everything measurably different from the window's dominant
 * color, so the probe works on any scene background and shrugs off
 * anti-aliasing fringes near the threshold.
 */
export async function staticInkPixels(
  page: Page,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<number> {
  return page.evaluate(
    ({ x, y, w, h }) => {
      const canvas = document.querySelector<HTMLCanvasElement>('canvas.vuedraw-canvas__static')
      if (!canvas) {
        throw new Error('static canvas missing')
      }
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('2d context unavailable')
      }
      const scaleX = canvas.width / canvas.clientWidth
      const scaleY = canvas.height / canvas.clientHeight
      const { data } = context.getImageData(
        Math.floor(x * scaleX),
        Math.floor(y * scaleY),
        Math.floor(w * scaleX),
        Math.floor(h * scaleY),
      )
      // The dominant color in a window is the background (or the fill under
      // a shape); ink is everything measurably different from it.
      const counts = new Map<string, number>()
      for (let i = 0; i < data.length; i += 4) {
        const key = `${data[i]!},${data[i + 1]!},${data[i + 2]!},${data[i + 3]!}`
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      let dominant = ''
      let dominantCount = -1
      for (const [key, count] of counts) {
        if (count > dominantCount) {
          dominant = key
          dominantCount = count
        }
      }
      const [dr, dg, db, da] = dominant.split(',').map(Number)
      let ink = 0
      for (let i = 0; i < data.length; i += 4) {
        if (
          Math.abs(data[i]! - dr!) > 24 ||
          Math.abs(data[i + 1]! - dg!) > 24 ||
          Math.abs(data[i + 2]! - db!) > 24 ||
          Math.abs(data[i + 3]! - da!) > 24
        ) {
          ink++
        }
      }
      return ink
    },
    { x, y, w, h },
  )
}

/** CSS-space bounding box of every inked pixel on the overlay canvas.
 *
 * Null when the overlay is completely empty. Coordinates are canvas-local,
 * matching the other probes.
 */
export async function overlayInkBounds(
  page: Page,
): Promise<{ minX: number; minY: number; maxX: number; maxY: number } | null> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.vuedraw-canvas__overlay')
    if (!canvas) {
      throw new Error('overlay canvas missing')
    }
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('2d context unavailable')
    }
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    const scale = canvas.width / canvas.clientWidth
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (data[(y * canvas.width + x) * 4 + 3]! === 0) {
          continue
        }
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
    if (!Number.isFinite(minX)) {
      return null
    }
    return { minX: minX / scale, minY: minY / scale, maxX: maxX / scale, maxY: maxY / scale }
  })
}
