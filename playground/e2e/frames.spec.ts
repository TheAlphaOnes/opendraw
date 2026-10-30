import type { Page } from '@playwright/test'

import { at, canvasBox, drag, expect, openEditor, pickFill, pickTool, scene, test, type MirroredElement, pickMoreTool } from './helpers'

/**
 * Frames behave like Excalidraw's: a container, not a shape. Elements drawn
 * inside join it, a frame drawn around elements adopts them, the frame
 * drags its children along, a dropped element joins or leaves, and the
 * frame's empty inside clicks through.
 */

async function frameAndChildren(page: Page): Promise<{ frame: MirroredElement; others: MirroredElement[] }> {
  const { elements } = await scene(page)
  const frame = elements.find((el) => el.type === 'frame')
  if (!frame) {
    throw new Error('no frame in the scene')
  }
  return { frame, others: elements.filter((el) => el.type !== 'frame') }
}

async function drawFrame(page: Page, x1: number, y1: number, x2: number, y2: number): Promise<void> {
  const box = await canvasBox(page)
  await pickMoreTool(page, 'Frame tool')
  await drag(page, at(box, x1, y1), at(box, x2, y2))
}

async function drawRect(page: Page, x1: number, y1: number, x2: number, y2: number): Promise<void> {
  const box = await canvasBox(page)
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, x1, y1), at(box, x2, y2))
}

test.describe('frames', () => {
  test('an element drawn inside a frame joins it', async ({ page }) => {
    await openEditor(page)
    await drawFrame(page, 100, 150, 400, 400)
    await drawRect(page, 150, 200, 250, 300)
    const { frame, others } = await frameAndChildren(page)
    expect(others[0]?.frameId).toBe(frame.id)
  })

  test('a frame drawn around elements adopts the ones completely inside', async ({ page }) => {
    await openEditor(page)
    await drawRect(page, 150, 200, 250, 300)
    await drawRect(page, 380, 200, 480, 300)
    await drawFrame(page, 100, 150, 420, 400)
    const { frame, others } = await frameAndChildren(page)
    const byX = [...others].sort((a, b) => a.x - b.x)
    expect(byX.map((el) => el.frameId)).toEqual([frame.id, null])
  })

  test('dragging a frame by its name carries its children', async ({ page }) => {
    await openEditor(page)
    await drawFrame(page, 100, 150, 400, 400)
    await drawRect(page, 150, 200, 250, 300)
    const box = await canvasBox(page)
    await pickTool(page, 'Selection (1)')
    // The name label sits just above the frame's top-left corner.
    await drag(page, at(box, 115, 140), at(box, 215, 190))
    const { frame, others } = await frameAndChildren(page)
    expect(frame.x).toBeCloseTo(200, 0)
    expect(others[0]!.x).toBeCloseTo(250, 0)
    expect(others[0]!.y).toBeCloseTo(250, 0)
  })

  test("a frame's empty inside clicks through to a marquee", async ({ page }) => {
    await openEditor(page)
    await drawFrame(page, 100, 150, 400, 400)
    const box = await canvasBox(page)
    await pickTool(page, 'Selection (1)')
    // Deselect the fresh frame first: a press inside a selection keeps it.
    await page.mouse.click(at(box, 600, 500).x, at(box, 600, 500).y)
    await page.mouse.click(at(box, 250, 280).x, at(box, 250, 280).y)
    expect((await scene(page)).selection).toEqual([])
  })

  test('a dragged element joins the frame it is dropped in, and leaves it again', async ({ page }) => {
    await openEditor(page)
    await pickFill(page)
    await drawRect(page, 500, 200, 580, 280)
    await drawFrame(page, 100, 150, 400, 400)
    const box = await canvasBox(page)
    await pickTool(page, 'Selection (1)')
    await drag(page, at(box, 540, 240), at(box, 240, 240))
    let { frame, others } = await frameAndChildren(page)
    expect(others[0]?.frameId).toBe(frame.id)
    await drag(page, at(box, 240, 240), at(box, 600, 240))
    ;({ frame, others } = await frameAndChildren(page))
    expect(others[0]?.frameId).toBeNull()
  })

  test('double-clicking the name renames the frame in place', async ({ page }) => {
    await openEditor(page)
    await drawFrame(page, 100, 150, 400, 400)
    const box = await canvasBox(page)
    await pickTool(page, 'Selection (1)')
    await page.mouse.dblclick(at(box, 115, 140).x, at(box, 115, 140).y)
    const input = page.getByRole('textbox', { name: 'Frame name' })
    await expect(input).toBeFocused()
    await input.fill('  Checkout flow ')
    await input.press('Enter')
    await expect(input).toHaveCount(0)
    const { frame } = await frameAndChildren(page)
    expect(frame.name).toBe('Checkout flow')
  })
})
