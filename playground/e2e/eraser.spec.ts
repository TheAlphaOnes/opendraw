import { at, canvasBox, drag, openEditor, pickTool, scene, test } from './helpers'
import { expect } from './helpers'

/**
 * Eraser parity: the stroke is the whole segment between pointer samples,
 * not just the sampled endpoints (Excalidraw eraser/index.ts). The fast
 * stroke below jumps the full width of the shape in ONE pointermove event,
 * endpoint-only erasing would pass around it on both sides.
 */
test('eraser removes an element it is dragged over, including one fast stroke', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 220, 140), at(box, 380, 240))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)

  await pickTool(page, 'Eraser (E)')
  const from = at(box, 200, 190)
  const to = at(box, 400, 190)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  // steps: 1, the entire crossing arrives as a single pointermove.
  await page.mouse.move(to.x, to.y, { steps: 1 })
  await page.mouse.up()

  await expect.poll(async () => (await scene(page)).elements.length).toBe(0)
})

test('a whole eraser stroke is a single undo step', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 220, 140), at(box, 380, 240))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)

  await pickTool(page, 'Eraser (E)')
  await drag(page, at(box, 200, 190), at(box, 400, 190))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(0)

  // One undo resurrects everything the stroke removed, beginStep on
  // pointerdown, endStep on pointerup.
  await page.getByRole('button', { name: /^Undo \(/ }).click()
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
})
