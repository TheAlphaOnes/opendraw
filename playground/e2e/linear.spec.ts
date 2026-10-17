import { at, canvasBox, drag, openEditor, pickFill, pickTool, scene, settleFrames, test, tipOf } from './helpers'
import { expect } from './helpers'

test('drags a selected arrow tip onto a shape and docks it', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickFill(page)
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 100, 150), at(box, 280, 270))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const rect = (await scene(page)).elements[0]!

  await pickTool(page, 'Arrow (5)')
  await drag(page, at(box, 380, 210), at(box, 480, 210))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(2)
  // The arrow stays selected after its draw — its tips show point handles.
  const arrow = (await scene(page)).elements[1]!
  expect(tipOf(arrow, 'end').x).toBeCloseTo(480, 0)

  // Grab the tip's point handle and drop it inside the rect: the tip
  // moves alone (no whole-arrow scaling) and docks on release.
  await drag(page, at(box, 480, 210), at(box, 240, 210))
  await settleFrames(page)

  const docked = (await scene(page)).elements.find((el) => el.id === arrow.id)!
  expect(docked.endBinding).toEqual({ elementId: rect.id })
  const tip = tipOf(docked, 'end')
  // Docked on the rect's own right edge, clear of it by the binding gap.
  expect(tip.x).toBeCloseTo(286, 0)
  expect(tip.y).toBeCloseTo(210, 0)
  // The start tip never moved and the tip count stayed at two.
  expect(tipOf(docked, 'start')).toEqual(tipOf(arrow, 'start'))
  expect(docked.points).toHaveLength(2)
})

test('inserts a point by dragging the segment midpoint of a selected line', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickTool(page, 'Line (6)')
  await drag(page, at(box, 100, 150), at(box, 480, 270))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const line = (await scene(page)).elements[0]!

  // The midpoint handle sits at (290, 210) — press it and drag down.
  await drag(page, at(box, 290, 210), at(box, 290, 300))
  await settleFrames(page)

  const bent = (await scene(page)).elements[0]!
  expect(bent.points).toHaveLength(3)
  // Start and end tips stay parked; the new middle point sits at the drop.
  expect(bent.points![0]).toEqual(line.points![0])
  expect(bent.points![2]).toEqual(line.points![1])
  expect(bent.points![1]).toEqual({ x: 190, y: 150 })
})

test('builds a polyline by clicking with the line tool', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickTool(page, 'Line (6)')
  // First click parks the start; each later click commits a point.
  await page.mouse.click(at(box, 100, 150).x, at(box, 100, 150).y)
  await page.mouse.click(at(box, 240, 200).x, at(box, 240, 200).y)
  await page.mouse.click(at(box, 380, 150).x, at(box, 380, 150).y)
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)

  const line = (await scene(page)).elements[0]!
  expect(line.points).toEqual([
    { x: 0, y: 0 },
    { x: 140, y: 50 },
    { x: 280, y: 0 },
  ])
  expect((await scene(page)).selection).toEqual([line.id])
})

test('finishes the draft with a double-click, dropping the temp tip', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickTool(page, 'Arrow (5)')
  await page.mouse.click(at(box, 100, 150).x, at(box, 100, 150).y)
  await page.mouse.click(at(box, 300, 250).x, at(box, 300, 250).y)
  // The second press of the double-click retreats the temp point; the
  // dblclick itself closes the draft with the committed points.
  await page.mouse.dblclick(at(box, 420, 180).x, at(box, 420, 180).y)
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)

  const arrow = (await scene(page)).elements[0]!
  expect(arrow.points).toEqual([
    { x: 0, y: 0 },
    { x: 200, y: 100 },
    { x: 320, y: 30 },
  ])
})
