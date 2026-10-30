import {
  at,
  canvasBox,
  drag,
  nonTransparentPixels,
  openEditor,
  overlayInkBounds,
  overlayPixelAt,
  pickFill,
  pickTool,
  scene,
  settleFrames,
  staticInkPixels,
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
  await expect(page.getByRole('button', { name: /^Undo \(/ })).toBeEnabled()
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
  const before = await nonTransparentPixels(page, 'opendraw-canvas__overlay')

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
  const after = await nonTransparentPixels(page, 'opendraw-canvas__overlay')
  expect(after).toBeGreaterThan(0)
  expect(after).toBeLessThanOrEqual(before + 48)
})

test('clears the marquee chrome when the drag ends empty', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickTool(page, 'Selection (1)')
  await drag(page, at(box, 500, 120), at(box, 700, 260))
  await settleFrames(page)

  expect(await nonTransparentPixels(page, 'opendraw-canvas__overlay')).toBe(0)
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

test('binds a line dropped over a shape exactly like an arrow', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  // A filled rectangle on the right half.
  await pickFill(page)
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 300, 150), at(box, 480, 270))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const rectId = (await scene(page)).elements[0]!.id

  // A line drawn from empty space into the rectangle's middle.
  await pickTool(page, 'Line (6)')
  await drag(page, at(box, 160, 210), at(box, 390, 210))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(2)

  const line = (await scene(page)).elements.find((el) => el.type === 'line')!
  expect(line.startBinding).toBeNull()
  expect(line.endBinding).toEqual({ elementId: rectId })
  // The dropped tip retracted onto the shape's near edge, not its middle.
  expect(tipOf(line, 'end').x).toBeLessThan(300)
  const looseStart = tipOf(line, 'start')

  // Move the rectangle away from under the line's tip.
  await pickTool(page, 'Selection (1)')
  const grab = at(box, 450, 250) // inside the rect, clear of the line stroke
  await page.mouse.move(grab.x, grab.y)
  await page.mouse.down()
  await page.mouse.move(grab.x + 200, grab.y, { steps: 10 })
  await page.mouse.up()

  // The bound tip rides along with the shape; the loose end stays put.
  await expect
    .poll(async () => tipOf((await scene(page)).elements.find((el) => el.id === line.id)!, 'end').x)
    .toBeGreaterThan(looseStart.x + 300)
  const movedLine = (await scene(page)).elements.find((el) => el.id === line.id)!
  expect(movedLine.endBinding).toEqual({ elementId: rectId })
  expect(tipOf(movedLine, 'start').x).toBe(looseStart.x)
})

test('outlines the shape an in-flight arrow tip would dock onto', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickFill(page)
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 300, 150), at(box, 480, 270))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)

  // Drop any selection so the overlay starts from zero ink.
  await pickTool(page, 'Selection (1)')
  await page.mouse.click(at(box, 550, 100).x, at(box, 550, 100).y)
  await settleFrames(page)
  // The rect's top edge, far above the drag path — empty before the drag.
  expect((await overlayPixelAt(page, 390, 150))[3]).toBe(0)

  // Hold the drag mid-flight with the drafted tip inside the shape.
  await pickTool(page, 'Arrow (5)')
  await page.mouse.move(at(box, 160, 210).x, at(box, 160, 210).y)
  await page.mouse.down()
  await page.mouse.move(at(box, 390, 210).x, at(box, 390, 210).y)
  await settleFrames(page)

  // The highlight strokes the shape's own outline in the selection teal.
  const during = await overlayPixelAt(page, 390, 150)
  expect(during[3]).toBe(255)
  expect(during.slice(0, 3)).toEqual([12, 133, 153])

  await page.mouse.up()
  await settleFrames(page)
  // The highlight exists only while the tip is in flight.
  expect((await overlayPixelAt(page, 390, 150))[3]).toBe(0)
})

test('rounds a selected rectangle from the style panel', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 300, 150), at(box, 480, 270))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const rect = (await scene(page)).elements[0]!
  expect(rect.roundness ?? null).toBe(null)

  // Sharp corners: both edges run straight through the corner window.
  await settleFrames(page)
  expect(await staticInkPixels(page, 300, 150, 6, 6)).toBeGreaterThan(8)

  await page.getByRole('radio', { name: 'Rounded corners' }).click()
  await expect.poll(async () => (await scene(page)).elements[0]!.roundness).toBe('round')

  // The corner arc's closest pass is ~10px out along the diagonal, so the
  // window right at the corner goes quiet.
  await settleFrames(page)
  expect(await staticInkPixels(page, 300, 150, 6, 6)).toBeLessThanOrEqual(3)

  // Toggling back patches roundness to null on the same element.
  await page.getByRole('radio', { name: 'Sharp corners' }).click()
  await expect.poll(async () => (await scene(page)).elements[0]!.roundness ?? null).toBe(null)
})

test('frames a line drawn up-left around its true bounds', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  // Drawn up-left: the last point lands negative of the origin. The gesture
  // stays in the upper strip of the canvas — the live style panel occupies
  // the bottom-center (client y > 400 in the 720px-tall e2e viewport), and
  // a press there hits the panel, not the canvas.
  await pickTool(page, 'Line (6)')
  await drag(page, at(box, 500, 280), at(box, 380, 180))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  await settleFrames(page)

  const line = (await scene(page)).elements[0]!
  expect(line.x).toBe(500)
  expect(line.y).toBe(280)
  expect(line.points![1]).toEqual({ x: -120, y: -100 })

  // The selection chrome hugs the true AABB (380,180)-(500,280): handles
  // inflate it by ~10px, the rotation handle ~20px above the top edge.
  const bounds = await overlayInkBounds(page)
  expect(bounds).not.toBeNull()
  const centerX = (bounds!.minX + bounds!.maxX) / 2
  const centerY = (bounds!.minY + bounds!.maxY) / 2
  expect(Math.abs(centerX - 440)).toBeLessThanOrEqual(25)
  expect(Math.abs(centerY - 230)).toBeLessThanOrEqual(25)
  expect(bounds!.maxX - bounds!.minX).toBeGreaterThan(120)
  expect(bounds!.maxY - bounds!.minY).toBeGreaterThan(100)
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

test('draws an ellipse that lands in the document selected', async ({ page }) => {
  await openEditor(page)
  await pickTool(page, 'Ellipse (4)')

  const box = await canvasBox(page)
  await drag(page, at(box, 220, 140), at(box, 380, 240))

  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const drawn = (await scene(page)).elements[0]!
  expect(drawn.type).toBe('ellipse')
  // The draw gesture ends with the shape selected and undo available.
  expect((await scene(page)).selection).toEqual([drawn.id])
  await expect(page.getByRole('button', { name: /^Undo \(/ })).toBeEnabled()
})

test('captures a freedraw stroke as a pointer-move pressure path', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickTool(page, 'Freedraw (P)')
  const start = at(box, 220, 140)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  // A zig-zag of intermediate points — each pointermove appends exactly
  // one path point.
  for (let i = 1; i <= 12; i++) {
    const point = at(box, 220 + i * 12, 140 + Math.round(Math.sin(i / 1.9) * 50))
    await page.mouse.move(point.x, point.y)
  }
  await page.mouse.up()

  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const stroke = (await scene(page)).elements[0]!
  expect(stroke.type).toBe('freedraw')
  // Every intermediate move landed in the path: the press point plus one
  // point per move event (the 12 zig-zag moves).
  const points = stroke.points as unknown as Array<[number, number, number]>
  expect(points.length).toBe(13)
  // The path is anchored at the press; points are relative to (x, y).
  expect(stroke.x).toBe(220)
  expect(stroke.y).toBe(140)
  expect(points[0]!.slice(0, 2)).toEqual([0, 0])
  expect(points[points.length - 1]!.slice(0, 2)).toEqual([144, Math.round(Math.sin(12 / 1.9) * 50)])
  // Mouse input simulates pressure at a flat 0.5 — the third channel.
  expect(points[0]![2]).toBe(0.5)

  // Excalidraw parity: a finished freedraw stroke is NOT auto-selected
  // (App.tsx excludes freedraw from the post-draw selection) and the
  // tool still reverts to selection.
  expect((await scene(page)).selection).toEqual([])
  await expect(page.getByRole('button', { name: 'Selection (1)' })).toBeEnabled()
})
