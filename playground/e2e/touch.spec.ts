/**
 * Touch e2e — two-finger pinch zoom and pan on a touch screen, driven
 * through Chrome's real touch input (CDP Input.dispatchTouchEvent), so the
 * page receives genuine multi-pointer events exactly as on a phone.
 */
import type { CDPSession, Page } from '@playwright/test'

import { STAGE_X, at, canvasBox, drag, openEditor, pickTool, scene, staticInkCentroid, test } from './helpers'
import { expect } from './helpers'

test.use({ hasTouch: true, viewport: { width: 1024, height: 720 } })

type Finger = { x: number; y: number }

async function touch(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', fingers: Finger[]): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: fingers.map((f, id) => ({ x: f.x, y: f.y, id })),
  })
}

/** Two fingers from `from` to `to`, in small steps like a real hand. */
async function twoFingers(page: Page, from: [Finger, Finger], to: [Finger, Finger], steps = 10): Promise<void> {
  const cdp = await page.context().newCDPSession(page)
  // The first finger lands a moment before the second, as hands do.
  await touch(cdp, 'touchStart', [from[0]])
  await touch(cdp, 'touchStart', from)
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const lerp = (a: Finger, b: Finger): Finger => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    await touch(cdp, 'touchMove', [lerp(from[0], to[0]), lerp(from[1], to[1])])
  }
  await touch(cdp, 'touchEnd', [])
}

const readout = (page: Page) => page.locator('.zoom-controls').getByRole('button', { name: /reset zoom/i })

test('two fingers spreading apart zoom in, without drawing anything', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 420, 260), at(box, 560, 360))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)

  // The rectangle tool is armed again: a pinch must still not draw.
  await pickTool(page, 'Rectangle (2)')
  const c = { x: box.x + 490, y: box.y + 310 }
  await twoFingers(page, [{ x: c.x - 60, y: c.y }, { x: c.x + 60, y: c.y }], [{ x: c.x - 150, y: c.y }, { x: c.x + 150, y: c.y }])

  await expect.poll(async () => parseInt((await readout(page).textContent()) ?? '0', 10)).toBeGreaterThan(200)
  expect((await scene(page)).elements).toHaveLength(1)
})

test('two fingers moving together pan the canvas', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 300, 260), at(box, 420, 340))
  const drawn = (await scene(page)).elements[0]!
  // The probe window is stage-relative (helpers offset it by STAGE_X): keep it on the canvas.
  const ink = () => staticInkCentroid(page, 0, 0, box.width - STAGE_X, box.height)
  const before = await ink()
  expect(before).not.toBeNull()

  const start = { x: box.x + 600, y: box.y + 300 }
  await twoFingers(
    page,
    [{ x: start.x - 50, y: start.y }, { x: start.x + 50, y: start.y }],
    [{ x: start.x - 50 + 120, y: start.y + 80 }, { x: start.x + 50 + 120, y: start.y + 80 }],
  )

  await expect(readout(page)).toHaveText('100%')
  await expect
    .poll(async () => {
      const after = await ink()
      return after ? Math.round(after.x - before!.x) : null
    })
    .toBeGreaterThan(100)
  const after = await ink()
  expect(after!.y - before!.y).toBeGreaterThan(60)
  // Only the view moved: the rectangle keeps its scene position.
  expect((await scene(page)).elements[0]).toMatchObject({ x: drawn.x, y: drawn.y })
})

test('a second finger rolls back the shape the first finger started', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)
  await pickTool(page, 'Rectangle (2)')
  const cdp = await page.context().newCDPSession(page)
  const a = { x: box.x + 300, y: box.y + 300 }
  // One finger starts drawing a rectangle...
  await touch(cdp, 'touchStart', [a])
  await touch(cdp, 'touchMove', [{ x: a.x + 40, y: a.y + 30 }])
  // ...then the second lands and the hand pinches.
  await touch(cdp, 'touchStart', [{ x: a.x + 40, y: a.y + 30 }, { x: a.x + 200, y: a.y + 30 }])
  await touch(cdp, 'touchMove', [{ x: a.x, y: a.y + 30 }, { x: a.x + 260, y: a.y + 30 }])
  await touch(cdp, 'touchEnd', [])
  expect((await scene(page)).elements).toHaveLength(0)
  // Nothing half-drawn is left on the undo stack either.
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()
})
