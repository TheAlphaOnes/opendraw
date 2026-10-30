import type { Page } from '@playwright/test'

import {
  at,
  canvasBox,
  drag,
  openEditor,
  pickFill,
  pickTool,
  settleFrames,
  staticInkCentroid,
  test,
} from './helpers'
import { expect } from './helpers'

/** The zoom readout button — its text is the live zoom percentage. */
function readout(page: Page) {
  return page.locator('.zoom-controls').getByRole('button', { name: /reset zoom/i })
}

test('zoom controls live in the bottom-left corner and report 100% initially', async ({ page }) => {
  await openEditor(page)

  const island = page.locator('.zoom-controls')
  await expect(island).toBeVisible()
  await expect(island.getByRole('button', { name: 'Zoom out' })).toBeVisible()
  await expect(island.getByRole('button', { name: 'Zoom in' })).toBeVisible()
  await expect(readout(page)).toHaveText('100%')

  // Bottom-left placement (Excalidraw parity): near the left edge, low on
  // the screen, clear of the bottom-center style panel.
  const box = await island.boundingBox()
  const view = page.viewportSize()
  expect(box, 'zoom island mounted').toBeTruthy()
  expect(box!.x).toBeLessThan(160)
  expect(box!.y).toBeGreaterThan(view!.height - 160)
})

test('the percentage readout tracks button zoom and resets on click', async ({ page }) => {
  await openEditor(page)

  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(readout(page)).toHaveText('125%')
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(readout(page)).toHaveText('156%')
  await page.getByRole('button', { name: 'Zoom out' }).click()
  await expect(readout(page)).toHaveText('125%')

  await readout(page).click()
  await expect(readout(page)).toHaveText('100%')
})

test('ctrl+wheel zooms toward the cursor', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  // A filled rectangle centered at (320, 200) canvas-local: the ink
  // centroid must stay pinned to the cursor while zooming at it.
  await pickTool(page, 'Rectangle (2)')
  await pickFill(page)
  await drag(page, at(box, 300, 180), at(box, 340, 220))
  await settleFrames(page)

  const before = await staticInkCentroid(page, 240, 120, 160, 160)
  expect(before?.count, 'rectangle rendered').toBeGreaterThan(400)

  const cursor = at(box, 320, 200)
  await page.mouse.move(cursor.x, cursor.y)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -120)
  await page.keyboard.up('Control')
  await settleFrames(page)

  // One wheel notch is one fixed step: Excalidraw clamps the tick's delta
  // to a 10% zoom step (App.wheel.ts `zoomBy`), so -120 lands at 110%.
  await expect(readout(page)).toHaveText('110%')

  const after = await staticInkCentroid(page, 160, 40, 320, 320)
  expect(after?.count, 'shape grew with the zoom').toBeGreaterThan(before!.count * 1.1)
  expect(Math.abs(after!.x - before!.x)).toBeLessThan(6)
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(6)
})

test('space+drag and middle-mouse drag pan the canvas', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickTool(page, 'Rectangle (2)')
  await pickFill(page)
  await drag(page, at(box, 300, 180), at(box, 340, 220))
  await settleFrames(page)

  const before = await staticInkCentroid(page, 240, 120, 160, 160)
  expect(before?.count, 'rectangle rendered').toBeGreaterThan(400)

  // Space-drag: the scene follows the pointer.
  await page.keyboard.down(' ')
  await drag(page, at(box, 500, 400), at(box, 600, 400))
  await page.keyboard.up(' ')
  await settleFrames(page)

  // The pan moved the scene +100 in x only: the rectangle now sits around
  // (420, 200) canvas-local, so the probe region must cover that spot.
  const afterSpace = await staticInkCentroid(page, 340, 120, 240, 160)
  expect(afterSpace?.count, 'rectangle still on screen').toBeGreaterThan(400)
  expect(afterSpace!.x).toBeCloseTo(before!.x + 100, 1)
  expect(afterSpace!.y).toBeCloseTo(before!.y, 1)

  // Middle-mouse drag pans the same way.
  const mid = at(box, 500, 400)
  await page.mouse.move(mid.x, mid.y)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(mid.x - 100, mid.y, { steps: 4 })
  await page.mouse.up({ button: 'middle' })
  await settleFrames(page)

  const afterMiddle = await staticInkCentroid(page, 240, 120, 160, 160)
  expect(afterMiddle?.count, 'rectangle back near its origin').toBeGreaterThan(400)
  expect(afterMiddle!.x).toBeCloseTo(before!.x, 1)
})

test('trackpad pinch-zoom surfaces as ctrl+wheel and zooms toward the cursor', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  // A filled rectangle centered at (320, 200) canvas-local.
  await pickTool(page, 'Rectangle (2)')
  await pickFill(page)
  await drag(page, at(box, 300, 180), at(box, 340, 220))
  await settleFrames(page)

  const before = await staticInkCentroid(page, 240, 120, 160, 160)
  expect(before?.count, 'rectangle rendered').toBeGreaterThan(400)

  // Honesty note: Playwright's input API cannot express a two-finger
  // pinch. A trackpad pinch never reaches the page as a gesture anyway —
  // the browser translates it into a stream of wheel events carrying the
  // ctrl modifier (the documented pinch-zoom mechanism in Chrome and
  // Safari). This spec drives exactly that event stream: ctrlKey wheel
  // ticks dispatched at the cursor position, one per gesture frame.
  const cursor = at(box, 320, 200)
  await page.evaluate(
    ({ x, y }) => {
      const host = document.querySelector('.opendraw-canvas')
      if (!(host instanceof HTMLElement)) {
        throw new Error('opendraw canvas missing')
      }
      // A pinch-in: small negative deltaY ticks, ~one per frame.
      for (let i = 0; i < 10; i++) {
        host.dispatchEvent(
          new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            ctrlKey: true,
            deltaX: 0,
            deltaY: -12,
            clientX: x,
            clientY: y,
          }),
        )
      }
    },
    { x: cursor.x, y: cursor.y },
  )
  await settleFrames(page)

  // Excalidraw parity: each -12 tick clamps to a +10% linear zoom step,
  // amplified by log10(zoom) * 0.6 once past 100% (App.wheel.ts `zoomBy`).
  // Ten ticks of -12 compound to ≈3.366 → 337%.
  await expect(readout(page)).toHaveText('337%')

  // Zoom-toward-cursor: the shape grows around the pinch point while its
  // ink centroid stays pinned there.
  const after = await staticInkCentroid(page, 160, 40, 320, 320)
  expect(after?.count, 'shape grew with the zoom').toBeGreaterThan(before!.count * 1.4)
  expect(Math.abs(after!.x - before!.x)).toBeLessThan(6)
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(6)
})
