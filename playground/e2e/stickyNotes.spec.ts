import { at, canvasBox, drag, expect, openEditor, pickTool, scene, test } from './helpers'

/**
 * Excalidraw's sticky notes: a click places the default square, a drag
 * sizes it (square unless Shift), and the label opens for typing at once;
 * long text shrinks the font before the note grows.
 */
test.describe('sticky notes', () => {
  test('a click places a 250px note and opens its label', async ({ page }) => {
    await openEditor(page)
    const box = await canvasBox(page)
    await pickTool(page, 'Sticky note (N)')
    await page.mouse.click(at(box, 300, 250).x, at(box, 300, 250).y)
    const editor = page.getByRole('textbox', { name: 'Text editor' })
    await expect(editor).toBeFocused()
    await page.keyboard.type('Ship it')
    await page.keyboard.press('Escape')
    const { elements, selection } = await scene(page)
    const note = elements.find((el) => el.type === 'stickynote')!
    expect(note).toMatchObject({ width: 250, height: 250, backgroundColor: '#ffdf6b' })
    expect(note.x).toBeCloseTo(175, 0)
    const label = elements.find((el) => el.type === 'text')!
    expect(label).toMatchObject({ containerId: note.id, text: 'Ship it' })
    expect(selection).toEqual([note.id])
  })

  test('a drag sizes a square note; long text shrinks the font, then grows the note', async ({ page }) => {
    await openEditor(page)
    const box = await canvasBox(page)
    await pickTool(page, 'Sticky note (N)')
    await drag(page, at(box, 100, 100), at(box, 260, 180))
    const editor = page.getByRole('textbox', { name: 'Text editor' })
    await expect(editor).toBeFocused()
    let note = (await scene(page)).elements.find((el) => el.type === 'stickynote')!
    expect(note.width).toBeCloseTo(160, 0)
    expect(note.height).toBeCloseTo(160, 0)
    await editor.fill('word '.repeat(80))
    const { elements } = await scene(page)
    note = elements.find((el) => el.type === 'stickynote')!
    const label = elements.find((el) => el.type === 'text')!
    expect(label.fontSize).toBe(16)
    expect(note.height).toBeGreaterThan(160)
  })

  test('N arms the tool and the panel offers the note palette', async ({ page }) => {
    await openEditor(page)
    await page.locator('.opendraw-canvas').click({ position: { x: 600, y: 500 } })
    await page.keyboard.press('n')
    await expect(page.getByRole('button', { name: 'Sticky note (N)' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('radio', { name: '#ffdf6b' })).toBeVisible()
    await expect(page.getByText('Text color')).toBeVisible()
  })
})
