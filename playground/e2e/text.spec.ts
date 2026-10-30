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

  await page.keyboard.type('hello opendraw')
  await page.keyboard.press('Escape')

  // Escape commits: element exists, stays selected, editor unmounts.
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const text = (await scene(page)).elements[0]!
  expect(text.type).toBe('text')
  expect(text.text).toBe('hello opendraw')
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
  await page.keyboard.type('hello opendraw')

  // The textarea is the single live copy while the session is open — the
  // static renderer skips the editing element, so the window around the
  // click holds no canvas ink yet.
  await settleFrames(page)
  const during = await staticInkPixels(page, 220, 175, 240, 80)
  expect(during).toBeLessThanOrEqual(4)

  await page.keyboard.press('Escape')
  await expect.poll(async () => (await scene(page)).elements[0]?.text ?? '').toBe('hello opendraw')
  await settleFrames(page)

  // Committed: the element now renders onto the canvas exactly once.
  const after = await staticInkPixels(page, 220, 175, 240, 80)
  expect(after).toBeGreaterThan(during + 40)
})

test('double-clicking existing text reopens the editor with its content', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  // Create and commit a text element first.
  await pickTool(page, 'Text (T)')
  await page.mouse.click(at(box, 300, 200).x, at(box, 300, 200).y)
  await page.keyboard.type('hello opendraw')
  await page.keyboard.press('Escape')
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const created = (await scene(page)).elements[0]!

  // The app reverted to the selection tool after creation. Double-click
  // the committed text: the wysiwyg editor reopens over it.
  await page.mouse.dblclick(at(box, 320, 200).x, at(box, 320, 200).y)

  const editor = page.getByRole('textbox', { name: 'Text editor' })
  await expect(editor).toBeVisible()
  await expect(editor).toBeFocused()
  // The session seeds from the existing content, not from empty.
  await expect(editor).toHaveValue('hello opendraw')

  // Typing extends the same element — no new element is created.
  await page.keyboard.type('!')
  await page.keyboard.press('Escape')

  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const edited = (await scene(page)).elements[0]!
  expect(edited.id).toBe(created.id)
  expect(edited.text).toBe('hello opendraw!')
  await expect(page.getByRole('textbox', { name: 'Text editor' })).toBeHidden()
})

test('clicking existing text with the text tool edits it in place', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickTool(page, 'Text (T)')
  await page.mouse.click(at(box, 300, 200).x, at(box, 300, 200).y)
  await page.keyboard.type('hello opendraw')
  await page.keyboard.press('Escape')
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const created = (await scene(page)).elements[0]!

  // Re-pick the text tool and click the existing text: Excalidraw opens
  // ITS editor instead of stacking a new element under the pointer.
  await pickTool(page, 'Text (T)')
  await page.mouse.click(at(box, 320, 200).x, at(box, 320, 200).y)

  const editor = page.getByRole('textbox', { name: 'Text editor' })
  await expect(editor).toBeVisible()
  await expect(editor).toBeFocused()
  await expect(editor).toHaveValue('hello opendraw')

  await page.keyboard.type(' again')
  await page.keyboard.press('Escape')

  // Still one element, same id, extended content.
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const edited = (await scene(page)).elements[0]!
  expect(edited.id).toBe(created.id)
  expect(edited.text).toBe('hello opendraw again')
})
