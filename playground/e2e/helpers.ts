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
  points?: Array<{ x: number; y: number }>
  startBinding?: { elementId: string } | null
  endBinding?: { elementId: string } | null
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
