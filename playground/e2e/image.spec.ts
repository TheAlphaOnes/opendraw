/**
 * Image tool e2e — toolbar picker insertion and drag behavior.
 *
 * Written but NOT executed in this round: the Playwright suite boots the
 * playground dev server, which cannot run in the sandbox this slice was
 * produced in. Typed against the strict e2e tsconfig; run with `pnpm e2e`.
 */

import { Buffer } from 'node:buffer'

import { at, canvasBox, drag, openEditor, pickTool, scene, settleFrames, test } from './helpers'
import { expect } from './helpers'

/**
 * A genuine 40x30 PNG rendered by the browser itself — no binary fixture
 * needs to live in the repo, and the dimensions are known exactly.
 */
async function tinyPngBuffer(page: import('@playwright/test').Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 40
    canvas.height = 30
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('2d context unavailable for the fixture render')
    }
    ctx.fillStyle = '#e03131'
    ctx.fillRect(0, 0, 40, 30)
    return canvas.toDataURL('image/png')
  })
  const base64 = dataUrl.split(',')[1]
  if (!base64) {
    throw new Error('fixture canvas produced no PNG data')
  }
  return Buffer.from(base64, 'base64')
}

test('inserts an image through the toolbar file picker', async ({ page }) => {
  await openEditor(page)
  const fixture = await tinyPngBuffer(page)

  // The image tool's only gesture is opening the picker (Excalidraw parity).
  const chooserPromise = page.waitForEvent('filechooser')
  await pickTool(page, 'Image (9)')
  const chooser = await chooserPromise
  await chooser.setFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: fixture })

  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const image = (await scene(page)).elements[0]!
  expect(image.type).toBe('image')
  // Insertion caps at the viewport center, fitted to a sensible box.
  expect(image.width).toBe(40)
  expect(image.height).toBe(30)
  expect(String(image.dataUrl).startsWith('data:image/png;base64,')).toBe(true)
  // The insert ends with the image selected, like every other tool.
  expect((await scene(page)).selection).toEqual([image.id])
})

test('moves the inserted image like any other element', async ({ page }) => {
  await openEditor(page)
  const fixture = await tinyPngBuffer(page)

  const chooserPromise = page.waitForEvent('filechooser')
  await pickTool(page, 'Image (9)')
  const chooser = await chooserPromise
  await chooser.setFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: fixture })
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const before = (await scene(page)).elements[0]!
  await settleFrames(page)

  // Grab the image by its interior and drag it — selection tool, default
  // identity viewport, so scene coordinates map 1:1 to canvas-local ones.
  await pickTool(page, 'Selection (1)')
  const box = await canvasBox(page)
  const grab = at(box, before.x + before.width! / 2, before.y + before.height! / 2)
  const target = at(box, before.x + before.width! / 2 + 120, before.y + before.height! / 2 + 60)
  await drag(page, grab, target)

  const after = (await scene(page)).elements[0]!
  expect(after.x).toBeCloseTo(before.x + 120, 0)
  expect(after.y).toBeCloseTo(before.y + 60, 0)
})
