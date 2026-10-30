import { at, canvasBox, drag, openEditor, pickTool, scene, test } from './helpers'
import { expect } from './helpers'

test('one undo press reverts exactly one drawn shape', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  // The app returns to the selection tool after each draw, re-pick it.
  const drawRectangleAt = async (x: number): Promise<void> => {
    await pickTool(page, 'Rectangle (2)')
    await drag(page, at(box, x, 120), at(box, x + 60, 180))
  }
  await drawRectangleAt(200)
  await drawRectangleAt(320)
  await drawRectangleAt(440)
  await expect.poll(async () => (await scene(page)).elements.length).toBe(3)

  // Three draws, three undo presses, selection and tool switches in
  // between must not have recorded anything.
  const undo = page.getByRole('button', { name: /^Undo \(/ })
  await undo.click()
  await expect.poll(async () => (await scene(page)).elements.length).toBe(2)
  await undo.click()
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  await undo.click()
  await expect.poll(async () => (await scene(page)).elements.length).toBe(0)
  await expect(undo).toBeDisabled()
})

test('switching tools never creates undo work', async ({ page }) => {
  await openEditor(page)

  const undo = page.getByRole('button', { name: /^Undo \(/ })
  await expect(undo).toBeDisabled()

  await pickTool(page, 'Rectangle (2)')
  await pickTool(page, 'Arrow (5)')
  await pickTool(page, 'Text (T)')
  await pickTool(page, 'Selection (1)')

  await expect(undo).toBeDisabled()
})
