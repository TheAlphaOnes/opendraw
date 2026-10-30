import {
  at,
  canvasBox,
  drag,
  openEditor,
  overlayPixelAt,
  pickFill,
  pickTool,
  scene,
  settleFrames,
  test,
  tipOf,
} from './helpers'
import { expect } from './helpers'

/** Computed cursor of the canvas host after moving the mouse to a canvas-local point. */
async function cursorAt(
  page: import('@playwright/test').Page,
  box: { x: number; y: number },
  x: number,
  y: number,
): Promise<string> {
  await page.mouse.move(at(box, x, y).x, at(box, x, y).y)
  await settleFrames(page)
  return page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('.opendraw-canvas')
    return host ? getComputedStyle(host).cursor : ''
  })
}

test('drags an unfilled rectangle from its middle', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  // No fill picked: the rect hit-tests on its outline only.
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 300, 150), at(box, 480, 270))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const rect = (await scene(page)).elements[0]!
  expect((await scene(page)).selection).toEqual([rect.id])

  // Drag from the interior — no stroke, no fill under the pointer.
  await drag(page, at(box, 390, 210), at(box, 510, 270))
  await settleFrames(page)

  const moved = (await scene(page)).elements[0]!
  expect(moved.x).toBe(rect.x + 120)
  expect(moved.y).toBe(rect.y + 60)
  // A grab is not a reselect: the same shape stays selected.
  expect((await scene(page)).selection).toEqual([moved.id])
})

test('resizes from the selection border, not just the corner handles', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 300, 150), at(box, 480, 270))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const rect = (await scene(page)).elements[0]!

  // Press 2px below the bottom border, well away from the mid-side handle
  // box, and drag the edge down.
  await drag(page, at(box, 330, 272), at(box, 330, 332))
  await settleFrames(page)

  const resized = (await scene(page)).elements[0]!
  expect(resized.y).toBe(rect.y)
  expect(resized.width).toBe(rect.width)
  expect(resized.height).toBeGreaterThan((rect.height ?? 0) + 50)
})

test('flips a resize through the opposite edge instead of jamming', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 300, 150), at(box, 480, 270))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const rect = (await scene(page)).elements[0]!

  // Drag the se corner past the anchored west edge: the rect must flip
  // through zero and regrow on the pointer's side, never jam at 1px.
  await drag(page, at(box, 480, 270), at(box, 240, 200))
  await settleFrames(page)

  const flipped = (await scene(page)).elements[0]!
  expect(flipped.width!).toBeGreaterThan(1)
  expect(flipped.height!).toBeGreaterThan(1)
  expect(flipped.x).toBeCloseTo(240, 0)
  expect(flipped.y).toBeCloseTo(rect.y, 0)
  expect(flipped.width).toBeCloseTo(rect.x - 240, 0)
  expect(flipped.height).toBeCloseTo(50, 0)
})

test('advertises every grab zone with the right cursor', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 300, 150), at(box, 480, 270))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  // The draw gesture ends with the shape selected, tool back on selection.

  // Interior of the selected frame: a grab.
  expect(await cursorAt(page, box, 390, 210)).toBe('move')
  // Just past the bottom border, away from the handle boxes: the side zone.
  expect(await cursorAt(page, box, 330, 272)).toBe('ns-resize')
  // The se corner handle.
  expect(await cursorAt(page, box, 480, 270)).toBe('nwse-resize')
  // The rotation handle above the top edge.
  expect(await cursorAt(page, box, 390, 128)).toBe('grab')
  // Far from everything.
  expect(await cursorAt(page, box, 600, 100)).toBe('default')

  // Draw tools crosshair their cursors.
  await pickTool(page, 'Line (6)')
  expect(await cursorAt(page, box, 600, 100)).toBe('crosshair')
})

test('outlines the start shape while a drag crosses onto the end shape', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickFill(page)
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 100, 150), at(box, 280, 270))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const startId = (await scene(page)).elements[0]!.id
  // The app returns to the selection tool after each draw — re-pick it.
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 380, 150), at(box, 560, 270))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(2)
  const endId = (await scene(page)).elements.find((el) => el.id !== startId)!.id

  // Drop any selection so the overlay starts from zero ink.
  await pickTool(page, 'Selection (1)')
  await page.mouse.click(at(box, 650, 100).x, at(box, 650, 100).y)
  await settleFrames(page)
  // Both top edges sit well away from the drag path (y = 210).
  expect((await overlayPixelAt(page, 190, 150))[3]).toBe(0)
  expect((await overlayPixelAt(page, 470, 150))[3]).toBe(0)

  // Drag an arrow from the middle of the left shape to the middle of the
  // right one, holding it mid-flight.
  await pickTool(page, 'Arrow (5)')
  await page.mouse.move(at(box, 190, 210).x, at(box, 190, 210).y)
  await page.mouse.down()
  await page.mouse.move(at(box, 470, 210).x, at(box, 470, 210).y)
  await settleFrames(page)

  // BOTH shapes carry the docking outline while the drag is in flight.
  const startEdge = await overlayPixelAt(page, 190, 150)
  const endEdge = await overlayPixelAt(page, 470, 150)
  expect(startEdge[3]).toBe(255)
  expect(startEdge.slice(0, 3)).toEqual([105, 101, 219])
  expect(endEdge[3]).toBe(255)
  expect(endEdge.slice(0, 3)).toEqual([105, 101, 219])

  await page.mouse.up()
  await settleFrames(page)
  // The highlights live only in flight.
  expect((await overlayPixelAt(page, 190, 150))[3]).toBe(0)
  expect((await overlayPixelAt(page, 470, 150))[3]).toBe(0)

  // The released arrow binds BOTH tips, not just the dragged one.
  const arrow = (await scene(page)).elements.find((el) => el.type === 'arrow')!
  expect(arrow.startBinding).toEqual({ elementId: startId })
  expect(arrow.endBinding).toEqual({ elementId: endId })
})

test('outlines a hoverable shape before the drag even starts', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickFill(page)
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 300, 150), at(box, 480, 270))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)

  // Drop the selection so any border ink can only be the hover highlight.
  await pickTool(page, 'Selection (1)')
  await page.mouse.click(at(box, 650, 100).x, at(box, 650, 100).y)
  await settleFrames(page)
  expect((await overlayPixelAt(page, 390, 150))[3]).toBe(0)

  // Hover — no press — with the arrow tool over the shape.
  await pickTool(page, 'Arrow (5)')
  await page.mouse.move(at(box, 390, 210).x, at(box, 390, 210).y)
  await settleFrames(page)
  const hovering = await overlayPixelAt(page, 390, 150)
  expect(hovering[3]).toBe(255)
  expect(hovering.slice(0, 3)).toEqual([105, 101, 219])

  // Moving off the shape clears the outline without any press.
  await page.mouse.move(at(box, 650, 210).x, at(box, 650, 210).y)
  await settleFrames(page)
  expect((await overlayPixelAt(page, 390, 150))[3]).toBe(0)
})

test('docks a diagonal arrow on the diamond\'s own edge, not its bounds box', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickTool(page, 'Diamond (3)')
  await drag(page, at(box, 400, 120), at(box, 560, 220))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const diamondId = (await scene(page)).elements[0]!.id

  // An arrow from empty space, diagonally into the diamond's middle.
  await pickTool(page, 'Arrow (5)')
  await drag(page, at(box, 240, 90), at(box, 480, 170))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(2)

  // The tip retracts onto the upper-left slanted edge (~423,151) — about
  // 40px inside where the bounds-box dock used to land on the border
  // (394,141), right under the selection frame.
  const arrow = (await scene(page)).elements.find((el) => el.type === 'arrow')!
  expect(arrow.endBinding).toEqual({ elementId: diamondId })
  const tip = tipOf(arrow, 'end')
  expect(tip.x).toBeGreaterThan(410)
  expect(tip.x).toBeLessThan(440)
  expect(tip.y).toBeGreaterThan(140)
  expect(tip.y).toBeLessThan(165)
})
