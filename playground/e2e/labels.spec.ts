/**
 * Labels e2e — Excalidraw's text containers: text typed into a shape wraps
 * and centers inside it, follows it, and goes where it goes.
 */
import type { Page } from '@playwright/test'

import { at, canvasBox, drag, openEditor, pickTool, scene, test } from './helpers'
import { expect } from './helpers'

type Box = { x: number; y: number; width: number; height: number }

async function drawUnfilledRect(page: Page, box: Box): Promise<string> {
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 200, 160), at(box, 400, 260))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  return (await scene(page)).elements[0]!.id
}

async function labelOf(page: Page, containerId: string) {
  return (await scene(page)).elements.find((el) => el.type === 'text' && el.containerId === containerId)
}

test('double-clicking inside an unfilled shape writes a centered label into it', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)
  const shape = await drawUnfilledRect(page, box)

  const inside = at(box, 300, 210)
  await page.mouse.dblclick(inside.x, inside.y)
  const editor = page.getByRole('textbox', { name: 'Text editor' })
  await expect(editor).toBeFocused()
  await page.keyboard.type('hello label')
  await page.keyboard.press('Escape')

  await expect.poll(async () => (await labelOf(page, shape))?.text).toBe('hello label')
  const label = (await labelOf(page, shape))!
  // Centered in the 200x100 shape at (200, 160).
  expect(label.x + label.width! / 2).toBeCloseTo(300, 0)
  expect(label.y + label.height! / 2).toBeCloseTo(210, 0)
  // The shape, not the label, stays the selection.
  expect((await scene(page)).selection).toEqual([shape])
})

test('a label wraps to its shape, grows it, and moves and deletes with it', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)
  const shape = await drawUnfilledRect(page, box)

  // Enter on the selected shape starts its label (Excalidraw parity).
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: 'Text editor' })).toBeFocused()
  await page.keyboard.type('a fairly long label that cannot fit on one line of this shape at all')
  await page.keyboard.press('Escape')

  await expect.poll(async () => ((await labelOf(page, shape))?.text as string | undefined)?.includes('\n')).toBe(true)
  const container = (await scene(page)).elements.find((el) => el.id === shape)!
  const label = (await labelOf(page, shape))!
  expect(label.width!).toBeLessThanOrEqual(190)
  expect(container.height!).toBeGreaterThanOrEqual(label.height! + 10)

  // Dragging the shape carries the label.
  const before = label.x
  await drag(page, at(box, 205, 165), at(box, 305, 165))
  await expect.poll(async () => (await labelOf(page, shape))!.x).toBeCloseTo(before + 100, 0)

  // Deleting the shape deletes its label; one undo brings both back.
  await page.keyboard.press('Delete')
  await expect.poll(async () => (await scene(page)).elements.length).toBe(0)
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await scene(page)).elements.length).toBe(2)
})

test('clicking a label selects its shape', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)
  const shape = await drawUnfilledRect(page, box)
  await page.keyboard.press('Enter')
  await page.keyboard.type('pick me')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await expect.poll(async () => (await scene(page)).selection).toEqual([])

  const label = (await labelOf(page, shape))!
  const point = at(box, label.x + label.width! / 2, label.y + label.height! / 2)
  await page.mouse.click(point.x, point.y)
  await expect.poll(async () => (await scene(page)).selection).toEqual([shape])
})
