import { at, canvasBox, drag, expect, openEditor, pickTool, scene, test } from './helpers'

/**
 * Excalidraw's color picker: the active-color swatch opens a popover with
 * the base grid (q…b hotkeys), shades (⇧1–⇧5), most used custom colors and
 * a hex field; picks apply live and Escape closes it.
 */
test.describe('color picker', () => {
  test.beforeEach(async ({ page }) => {
    await openEditor(page)
    const box = await canvasBox(page)
    await pickTool(page, 'Rectangle (2)')
    await drag(page, at(box, 300, 200), at(box, 450, 320))
  })

  test('hotkeys pick a base color and its shades, Escape closes', async ({ page }) => {
    await page.getByRole('button', { name: 'Background color picker' }).click()
    const dialog = page.getByRole('dialog', { name: 'Background color picker' })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('s')
    expect((await scene(page)).elements[0]?.backgroundColor).toBe('#a5d8ff')
    await page.keyboard.press('Shift+Digit4')
    expect((await scene(page)).elements[0]?.backgroundColor).toBe('#228be6')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('a typed hex code applies and then shows up as a custom color', async ({ page }) => {
    await page.getByRole('button', { name: 'Stroke color picker' }).click()
    const hex = page.getByRole('textbox', { name: 'Hex code' })
    await hex.fill('12ab34')
    expect((await scene(page)).elements[0]?.strokeColor).toBe('#12ab34')
    await expect(page.getByRole('alert')).toHaveCount(0)
    await hex.fill('12ab3')
    await expect(page.getByRole('alert')).toHaveText('Hex code must be 3, 4, 6, or 8 characters')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Stroke color picker' }).click()
    await expect(page.getByRole('button', { name: 'Most used custom colors #12ab34' })).toBeVisible()
  })
})
