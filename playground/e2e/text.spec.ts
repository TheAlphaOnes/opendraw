import { at, canvasBox, openEditor, pickTool, scene, settleFrames, staticInkPixels, test } from './helpers'
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

test('renders text once: the canvas stays blank while the editor is open', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickTool(page, 'Text (T)')
  await page.mouse.click(at(box, 300, 200).x, at(box, 300, 200).y)

  const editor = page.getByRole('textbox', { name: 'Text editor' })
  await expect(editor).toBeFocused()
  await page.keyboard.type('hello vuedraw')

  // The textarea is the single live copy while the session is open — the
  // static renderer skips the editing element, so the window around the
  // click holds no canvas ink yet.
  await settleFrames(page)
  const during = await staticInkPixels(page, 220, 175, 240, 80)
  expect(during).toBeLessThanOrEqual(4)

  await page.keyboard.press('Escape')
  await expect.poll(async () => (await scene(page)).elements[0]?.text ?? '').toBe('hello vuedraw')
  await settleFrames(page)

  // Committed: the element now renders onto the canvas exactly once.
  const after = await staticInkPixels(page, 220, 175, 240, 80)
  expect(after).toBeGreaterThan(during + 40)
})
