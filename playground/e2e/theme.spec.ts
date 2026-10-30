import { at, canvasBox, openEditor, pickTool, pixelAt, settleFrames, test, runMenuItem } from './helpers'
import { expect } from './helpers'

test('switches the scene to dark and back', async ({ page }) => {
  await openEditor(page)
  await settleFrames(page)

  expect(await pixelAt(page, 6, 6)).toEqual([255, 255, 255])
  await expect(page.locator('.opendraw-root')).toHaveAttribute('data-theme', 'light')

  await runMenuItem(page, /^Dark mode/)
  await expect(page.locator('.opendraw-root')).toHaveAttribute('data-theme', 'dark')
  await settleFrames(page)
  expect(await pixelAt(page, 6, 6)).toEqual([18, 18, 18])

  await runMenuItem(page, /^Light mode/)
  await expect(page.locator('.opendraw-root')).toHaveAttribute('data-theme', 'light')
  await settleFrames(page)
  expect(await pixelAt(page, 6, 6)).toEqual([255, 255, 255])
})

test('the wysiwyg editor types in the dark theme ink', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await runMenuItem(page, /^Dark mode/)
  await expect(page.locator('.opendraw-root')).toHaveAttribute('data-theme', 'dark')

  await pickTool(page, 'Text (T)')
  await page.mouse.click(at(box, 300, 200).x, at(box, 300, 200).y)
  const editor = page.getByRole('textbox', { name: 'Text editor' })
  await expect(editor).toBeFocused()

  // The editor paints the same near-white the committed render will,
  // never the raw dark ink that disappears on the dark canvas.
  const color = await editor.evaluate((node) => getComputedStyle(node).color)
  expect(color).toBe('rgb(211, 211, 211)')

  await page.keyboard.press('Escape')
})
