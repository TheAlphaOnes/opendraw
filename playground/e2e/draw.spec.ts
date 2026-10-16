import {
  at,
  canvasBox,
  drag,
  nonTransparentPixels,
  openEditor,
  pickFill,
  pickTool,
  scene,
  settleFrames,
  test,
  tipOf,
} from './helpers'
import { expect } from './helpers'

test('draws a rectangle that lands in the document selected', async ({ page }) => {
  await openEditor(page)
  await pickTool(page, 'Rectangle (2)')

  const box = await canvasBox(page)
  await drag(page, at(box, 220, 140), at(box, 380, 240))

  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const drawn = (await scene(page)).elements[0]!
  expect(drawn.type).toBe('rectangle')
  // The draw gesture ends with the shape selected and undo available.
  expect((await scene(page)).selection).toEqual([drawn.id])
  await expect(page.getByRole('button', { name: 'Undo (Ctrl+Z)' })).toBeEnabled()
})

test('leaves no selection-chrome trail while dragging', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickFill(page)
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 220, 140), at(box, 380, 240))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)

  // Select it, then drag it through a zig-zag of intermediate positions.
  await pickTool(page, 'Selection (1)')
  await page.mouse.click(at(box, 300, 190).x, at(box, 300, 190).y)
  await settleFrames(page)
  const before = await nonTransparentPixels(page, 'vuedraw-canvas__overlay')

  const grab = at(box, 300, 190)
  await page.mouse.move(grab.x, grab.y)
  await page.mouse.down()
  for (let i = 1; i <= 24; i++) {
    const wobble = at(box, 300 + Math.sin(i / 2.5) * 60, 190 + Math.cos(i / 1.7) * 40)
    await page.mouse.move(wobble.x, wobble.y)
  }
  await page.mouse.up()
  await settleFrames(page)

  // One clean frame: the overlay holds exactly the current selection box.
  const after = await nonTransparentPixels(page, 'vuedraw-canvas__overlay')
  expect(after).toBeGreaterThan(0)
  expect(after).toBeLessThanOrEqual(before + 48)
})

test('clears the marquee chrome when the drag ends empty', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickTool(page, 'Selection (1)')
  await drag(page, at(box, 500, 120), at(box, 700, 260))
  await settleFrames(page)

  expect(await nonTransparentPixels(page, 'vuedraw-canvas__overlay')).toBe(0)
})

test('binds an arrow dropped over a shape and follows it', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  // A filled rectangle on the right half.
  await pickFill(page)
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 300, 150), at(box, 480, 270))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const rectId = (await scene(page)).elements[0]!.id

  // An arrow drawn from empty space into the rectangle's middle.
  await pickTool(page, 'Arrow (5)')
  await drag(page, at(box, 160, 210), at(box, 390, 210))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(2)

  const arrow = (await scene(page)).elements.find((el) => el.type === 'arrow')!
  expect(arrow.startBinding).toBeNull()
  expect(arrow.endBinding).toEqual({ elementId: rectId })
  // The dropped tip retracted onto the shape's near edge, not its middle.
  expect(tipOf(arrow, 'end').x).toBeLessThan(300)
  const looseStart = tipOf(arrow, 'start')

  // Move the rectangle away from under the arrow's tip.
  await pickTool(page, 'Selection (1)')
  const grab = at(box, 450, 250) // inside the rect, clear of the arrow stroke
  await page.mouse.move(grab.x, grab.y)
  await page.mouse.down()
  await page.mouse.move(grab.x + 200, grab.y, { steps: 10 })
  await page.mouse.up()

  // The bound tip rides along with the shape; the loose end stays put.
  await expect
    .poll(async () => tipOf((await scene(page)).elements.find((el) => el.id === arrow.id)!, 'end').x)
    .toBeGreaterThan(looseStart.x + 300)
  const moved = (await scene(page)).elements.find((el) => el.id === arrow.id)!
  expect(moved.endBinding).toEqual({ elementId: rectId })
  expect(tipOf(moved, 'start').x).toBe(looseStart.x)
})

test('narrows a multi-selection with a plain click on one shape', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickFill(page)
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 220, 140), at(box, 300, 220))
  const firstId = (await scene(page)).elements[0]!.id
  // The app returns to the selection tool after each draw — re-pick it.
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 340, 140), at(box, 420, 220))
  const secondId = (await scene(page)).elements.find((el) => el.id !== firstId)!.id

  // Marquee over both, then a plain click on the second one narrows to it.
  await pickTool(page, 'Selection (1)')
  await drag(page, at(box, 200, 120), at(box, 440, 240))
  await expect.poll(async () => (await scene(page)).selection.length).toBe(2)

  await page.mouse.click(at(box, 380, 180).x, at(box, 380, 180).y)
  await expect.poll(async () => (await scene(page)).selection).toEqual([secondId])
})
