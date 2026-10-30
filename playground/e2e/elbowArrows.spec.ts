/**
 * Elbow arrows e2e — Excalidraw's "Arrow type" property: sharp, curved and
 * elbow. An elbow arrow routes in axis-aligned legs around the shapes it
 * binds, re-routes when they move, and A cycles the type while the arrow
 * tool is armed.
 */
import { at, canvasBox, drag, openEditor, pickTool, scene, test } from './helpers'
import { expect } from './helpers'

type Point = { x: number; y: number }

/** Every leg of an elbow route is horizontal or vertical. */
function isOrthogonal(points: Point[]): boolean {
  return points.every((point, i) => i === 0 || Math.abs(point.x - points[i - 1]!.x) < 0.5 || Math.abs(point.y - points[i - 1]!.y) < 0.5)
}

test('draws a bound elbow arrow between two shapes and re-routes it on move', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 120, 120), at(box, 240, 200))
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 420, 300), at(box, 540, 380))

  await pickTool(page, 'Arrow (5)')
  await page.getByRole('radio', { name: 'Elbow arrow' }).click()
  await drag(page, at(box, 180, 160), at(box, 480, 340))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(3)

  const [first, second, arrow] = (await scene(page)).elements
  expect(arrow!.elbowed).toBe(true)
  expect(arrow!.roundness).toBeNull()
  expect(arrow!.startBinding?.elementId).toBe(first!.id)
  expect(arrow!.endBinding?.elementId).toBe(second!.id)
  expect(arrow!.points!.length).toBeGreaterThan(2)
  expect(isOrthogonal(arrow!.points!)).toBe(true)

  // Dragging the end shape re-routes the arrow, still in straight legs.
  const before = JSON.stringify(arrow!.points)
  await pickTool(page, 'Selection (1)')
  // Grab the transparent rectangle by its stroke, as in Excalidraw.
  await drag(page, at(box, 460, 380), at(box, 460, 140))
  await expect.poll(async () => (await scene(page)).elements[1]!.y).toBeLessThan(second!.y - 100)
  await expect.poll(async () => JSON.stringify((await scene(page)).elements[2]!.points)).not.toBe(before)
  const moved = (await scene(page)).elements[2]!
  expect(moved.endBinding?.elementId).toBe(second!.id)
  expect(isOrthogonal(moved.points!)).toBe(true)
})

test('A cycles the arrow type while the arrow tool is armed', async ({ page }) => {
  await openEditor(page)
  await pickTool(page, 'Arrow (5)')
  const radio = (name: string) => page.getByRole('radio', { name })
  // Curved is the default, as in Excalidraw (currentItemArrowType: round).
  await expect(radio('Curved arrow')).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('a')
  await expect(radio('Elbow arrow')).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('a')
  await expect(radio('Sharp arrow')).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('a')
  await expect(radio('Curved arrow')).toHaveAttribute('aria-checked', 'true')
})

test('changes a selected arrow to elbow and back as one undo step each', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)
  await pickTool(page, 'Arrow (5)')
  await drag(page, at(box, 200, 200), at(box, 420, 320))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)

  await page.getByRole('radio', { name: 'Elbow arrow' }).click()
  await expect.poll(async () => (await scene(page)).elements[0]!.elbowed).toBe(true)
  expect(isOrthogonal((await scene(page)).elements[0]!.points!)).toBe(true)

  await page.getByRole('radio', { name: 'Curved arrow' }).click()
  await expect.poll(async () => (await scene(page)).elements[0]!.roundness).toBe('round')
  expect((await scene(page)).elements[0]!.elbowed).toBeFalsy()

  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await scene(page)).elements[0]!.elbowed).toBe(true)
})
