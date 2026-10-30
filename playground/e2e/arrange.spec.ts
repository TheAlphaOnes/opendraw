/**
 * Arrange e2e, groups, align, flip, alt-drag duplication, style copy and
 * the context menu, each pinned to the Excalidraw behavior it ports.
 */
import type { Page } from '@playwright/test'

import { at, canvasBox, drag, openEditor, pickFill, pickTool, scene, test } from './helpers'
import { expect } from './helpers'

type Box = { x: number; y: number; width: number; height: number }

/** Draws a filled rectangle between two canvas-local corners; returns its id. */
async function drawRect(page: Page, box: Box, x1: number, y1: number, x2: number, y2: number): Promise<string> {
  const before = new Set((await scene(page)).elements.map((el) => el.id))
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, x1, y1), at(box, x2, y2))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(before.size + 1)
  return (await scene(page)).elements.find((el) => !before.has(el.id))!.id
}

async function element(page: Page, id: string) {
  return (await scene(page)).elements.find((el) => el.id === id)!
}

async function click(page: Page, box: Box, x: number, y: number): Promise<void> {
  const point = at(box, x, y)
  await page.mouse.click(point.x, point.y)
}

test('groups with Mod+G: a click selects the group, double-click enters it, Esc steps out', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)
  await pickFill(page)
  const a = await drawRect(page, box, 200, 140, 280, 220)
  const b = await drawRect(page, box, 340, 140, 420, 220)

  await page.keyboard.press('Control+a')
  await page.keyboard.press('Control+g')
  await expect.poll(async () => ((await element(page, a)).groupIds as string[]).length).toBe(1)
  expect((await element(page, a)).groupIds).toEqual((await element(page, b)).groupIds)

  // A plain click on one member selects the whole group.
  await page.keyboard.press('Escape')
  await expect.poll(async () => (await scene(page)).selection).toEqual([])
  await click(page, box, 240, 180)
  await expect.poll(async () => (await scene(page)).selection.sort()).toEqual([a, b].sort())

  // Double-click enters the group: the member alone is selected.
  const point = at(box, 240, 180)
  await page.mouse.dblclick(point.x, point.y)
  await expect.poll(async () => (await scene(page)).selection).toEqual([a])

  // Escape steps back out to the whole group.
  await page.keyboard.press('Escape')
  await expect.poll(async () => (await scene(page)).selection.sort()).toEqual([a, b].sort())

  // Ungroup, then a single undo restores the group.
  await page.keyboard.press('Control+Shift+g')
  await expect.poll(async () => ((await element(page, a)).groupIds as string[]).length).toBe(0)
  await page.keyboard.press('Control+z')
  await expect.poll(async () => ((await element(page, a)).groupIds as string[]).length).toBe(1)
})

test('aligns left edges with Mod+Shift+Left and flips with Shift+H', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)
  await pickFill(page)
  const a = await drawRect(page, box, 200, 140, 260, 200)
  const b = await drawRect(page, box, 340, 260, 440, 320)

  await page.keyboard.press('Control+a')
  await page.keyboard.press('Control+Shift+ArrowLeft')
  await expect.poll(async () => (await element(page, b)).x).toBe((await element(page, a)).x)

  // Flip mirrors across the selection's center: the narrow shape's left
  // edge lands where the wide one's right edge was.
  const before = { a: await element(page, a), b: await element(page, b) }
  await page.keyboard.press('Shift+H')
  await expect.poll(async () => (await element(page, a)).x).not.toBe(before.a.x)
  const right = Math.max(before.a.x + before.a.width!, before.b.x + before.b.width!)
  const left = Math.min(before.a.x, before.b.x)
  expect((await element(page, a)).x).toBeCloseTo(left + right - (before.a.x + before.a.width!), 5)
})

test('alt-drag leaves the original in place and drags a selected copy', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)
  await pickFill(page)
  const original = await drawRect(page, box, 200, 140, 280, 220)
  const startX = (await element(page, original)).x

  await page.keyboard.down('Alt')
  await drag(page, at(box, 240, 180), at(box, 400, 180))
  await page.keyboard.up('Alt')

  await expect.poll(async () => (await scene(page)).elements.length).toBe(2)
  expect((await element(page, original)).x).toBe(startX)
  const copy = (await scene(page)).elements.find((el) => el.id !== original)!
  expect(copy.x).toBe(startX + 160)
  expect((await scene(page)).selection).toEqual([copy.id])

  // The duplicate-and-drag is one gesture: one undo removes the copy.
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
})

test('copies and pastes styles with Mod+Alt+C / Mod+Alt+V', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)
  await pickFill(page)
  const styled = await drawRect(page, box, 200, 140, 280, 220)
  await page.getByRole('radio', { name: '#e03131' }).check()
  await expect.poll(async () => (await element(page, styled)).strokeColor).toBe('#e03131')
  const plain = await drawRect(page, box, 340, 140, 420, 220)
  expect((await element(page, plain)).strokeColor).not.toBe('#e03131')

  await click(page, box, 240, 180)
  await page.keyboard.press('Control+Alt+c')
  await click(page, box, 380, 180)
  await page.keyboard.press('Control+Alt+v')
  await expect.poll(async () => (await element(page, plain)).strokeColor).toBe('#e03131')
})

test('the context menu acts on the element under the pointer', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)
  await pickFill(page)
  await drawRect(page, box, 200, 140, 280, 220)
  await page.keyboard.press('Escape')

  const point = at(box, 240, 180)
  await page.mouse.click(point.x, point.y, { button: 'right' })
  const menu = page.getByRole('menu', { name: 'Element actions' })
  await expect(menu).toBeVisible()
  // Only applicable actions are listed: one element cannot be grouped.
  await expect(menu.getByRole('menuitem', { name: /Flip horizontal/ })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: /Group selection/ })).toHaveCount(0)

  await menu.getByRole('menuitem', { name: /Duplicate/ }).click()
  await expect.poll(async () => (await scene(page)).elements.length).toBe(2)
  await expect(menu).toBeHidden()

  // Empty canvas opens the canvas menu instead.
  const empty = at(box, 600, 400)
  await page.mouse.click(empty.x, empty.y, { button: 'right' })
  await expect(page.getByRole('menu', { name: 'Canvas actions' })).toBeVisible()
})

test('the marquee selects only what it wholly contains', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)
  await pickFill(page)
  const id = await drawRect(page, box, 220, 160, 300, 240)
  await page.keyboard.press('Escape')

  await drag(page, at(box, 200, 140), at(box, 260, 260))
  expect((await scene(page)).selection).toEqual([])
  await drag(page, at(box, 200, 140), at(box, 320, 260))
  await expect.poll(async () => (await scene(page)).selection).toEqual([id])
})

test('the pen stays armed after a stroke and Q locks any tool', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  await pickTool(page, 'Freedraw (P)')
  await drag(page, at(box, 200, 140), at(box, 300, 200))
  await expect(page.getByRole('button', { name: 'Freedraw (P)' })).toHaveAttribute('aria-pressed', 'true')

  await pickTool(page, 'Rectangle (2)')
  await page.keyboard.press('q')
  await drag(page, at(box, 200, 260), at(box, 260, 320))
  await drag(page, at(box, 320, 260), at(box, 380, 320))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(3)
  await expect(page.getByRole('button', { name: 'Rectangle (2)' })).toHaveAttribute('aria-pressed', 'true')
  // A locked tool keeps drawing, so nothing is selected between draws.
  expect((await scene(page)).selection).toEqual([])
})

test('Shift+1 zooms to fit every element', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)
  await pickFill(page)
  await drawRect(page, box, 220, 160, 260, 200)
  await drawRect(page, box, 560, 300, 600, 340)
  const readout = page.locator('.zoom-controls').getByRole('button', { name: /reset zoom/i })
  await expect(readout).toHaveText('100%')
  // Zoom in first so the fit has to scale back down (capped at 100%).
  await page.keyboard.press('Control+=')
  await expect(readout).not.toHaveText('100%')
  await page.keyboard.press('Shift+Digit1')
  await expect(readout).toHaveText('100%')
})
