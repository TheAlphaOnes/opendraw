/**
 * Arrowheads e2e — Excalidraw's start/end arrowhead property: pickers in
 * the properties island restyle the selected arrow, and with nothing
 * selected they set the heads of the next arrow drawn.
 */
import { at, canvasBox, drag, openEditor, pickTool, scene, test } from './helpers'
import { expect } from './helpers'

test('picks start and end arrowheads for the selected arrow', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)
  await pickTool(page, 'Arrow (5)')
  await drag(page, at(box, 200, 200), at(box, 420, 200))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const arrow = (await scene(page)).elements[0]!
  expect(arrow.endArrowhead).toBe('arrow')
  expect(arrow.startArrowhead).toBeNull()

  await page.getByRole('button', { name: /^End arrowhead/ }).click()
  await page.getByRole('listbox', { name: 'End arrowhead' }).getByRole('option', { name: 'Triangle', exact: true }).click()
  await expect.poll(async () => (await scene(page)).elements[0]!.endArrowhead).toBe('triangle')

  await page.getByRole('button', { name: /^Start arrowhead/ }).click()
  await page.getByRole('listbox', { name: 'Start arrowhead' }).getByRole('option', { name: 'Circle (outline)' }).click()
  await expect.poll(async () => (await scene(page)).elements[0]!.startArrowhead).toBe('circle_outline')

  // Each pick is its own undo step.
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await scene(page)).elements[0]!.startArrowhead).toBeNull()
})

test('an armed arrow tool sets the heads of the next arrow', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)
  await pickTool(page, 'Arrow (5)')
  await page.getByRole('button', { name: /^End arrowhead/ }).click()
  await page.getByRole('option', { name: 'None' }).click()
  await page.keyboard.press('Escape')
  await pickTool(page, 'Arrow (5)')
  await drag(page, at(box, 200, 200), at(box, 420, 260))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  expect((await scene(page)).elements[0]!.endArrowhead).toBeNull()
})
