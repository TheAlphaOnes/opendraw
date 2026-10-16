import { at, canvasBox, openEditor, pickTool, scene, test } from './helpers'
import { expect } from './helpers'

test('creates a text element through the wysiwyg editor', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickTool(page, 'Text (T)')
  await page.mouse.click(at(box, 300, 200).x, at(box, 300, 200).y)

  const editor = page.getByRole('textbox', { name: 'Text editor' })
  await expect(editor).toBeVisible()
  await expect(editor).toBeFocused()

  await page.keyboard.type('hello vuedraw')
  await page.keyboard.press('Escape')

  // Escape commits: element exists, stays selected, editor unmounts.
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const text = (await scene(page)).elements[0]!
  expect(text.type).toBe('text')
  expect(text.text).toBe('hello vuedraw')
  expect((await scene(page)).selection).toEqual([text.id])
  await expect(page.getByRole('textbox', { name: 'Text editor' })).toBeHidden()
})
