/**
 * Toolbar e2e — the top-center tool island must match Excalidraw's
 * arrangement: the tool lock, every main tool with its key hint, and the
 * "More tools" dropdown holding the frame tool and the laser pointer.
 */
import type { Page } from '@playwright/test'

import { expect, openEditor, pickMoreTool, test } from './helpers'

const TOOL_LOCK = 'Keep selected tool active after drawing (Q)'

/** Excalidraw's island order, one entry per toolbar button. */
const TOOL_ORDER = [
  TOOL_LOCK,
  'Hand (H)',
  'Selection (1)',
  'Rectangle (2)',
  'Diamond (3)',
  'Ellipse (4)',
  'Arrow (5)',
  'Line (6)',
  'Freedraw (P)',
  'Text (T)',
  'Sticky note (N)',
  'Image (9)',
  'Eraser (E)',
  'More tools',
] as const

async function dockBox(page: Page): Promise<{ x: number; y: number; width: number }> {
  const box = await page.locator('.tool-dock').boundingBox()
  if (!box) {
    throw new Error('tool dock did not render')
  }
  return box
}

test('renders every tool in the top-center island in Excalidraw order', async ({ page }) => {
  await openEditor(page)

  const dock = page.getByRole('toolbar', { name: 'Drawing tools' })
  await expect(dock).toBeVisible()

  // DOM order of the accessible names must equal Excalidraw's island order.
  const labels = await dock.getByRole('button').evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute('aria-label')),
  )
  expect(labels).toEqual([...TOOL_ORDER])

  // The island sits at the top, horizontally centered on the viewport.
  const viewport = page.viewportSize()
  if (!viewport) {
    throw new Error('viewport size unavailable')
  }
  const box = await dockBox(page)
  expect(box.y).toBeLessThan(64)
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2)
})

test('shows each tool key in the button corner, number keys first', async ({ page }) => {
  await openEditor(page)
  const dock = page.getByRole('toolbar', { name: 'Drawing tools' })
  await expect(dock.getByRole('button', { name: 'Selection (1)' })).toContainText('1')
  await expect(dock.getByRole('button', { name: 'Freedraw (P)' })).toContainText('7')
  await expect(dock.getByRole('button', { name: 'Sticky note (N)' })).toContainText('N')
})

test('keeps the frame tool and laser pointer under "More tools"', async ({ page }) => {
  await openEditor(page)
  const more = page.getByRole('button', { name: 'More tools' })
  await more.click()
  const menu = page.getByRole('menu', { name: 'More tools' })
  await expect(menu.getByRole('menuitem')).toHaveText([/Frame tool\s*F/, /Laser pointer\s*K/])
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()

  // An extra tool in use lights the trigger up.
  await pickMoreTool(page, 'Frame tool')
  await expect(more).toHaveAttribute('aria-pressed', 'true')
})

test('starts on selection and marks the clicked tool active', async ({ page }) => {
  await openEditor(page)

  const selection = page.getByRole('button', { name: 'Selection (1)' })
  const rectangle = page.getByRole('button', { name: 'Rectangle (2)' })

  await expect(selection).toHaveAttribute('aria-pressed', 'true')
  await expect(rectangle).toHaveAttribute('aria-pressed', 'false')

  await rectangle.click()
  await expect(rectangle).toHaveAttribute('aria-pressed', 'true')
  await expect(selection).toHaveAttribute('aria-pressed', 'false')

  await selection.click()
  await expect(selection).toHaveAttribute('aria-pressed', 'true')
  await expect(rectangle).toHaveAttribute('aria-pressed', 'false')
})

test('keeps the image insertion gesture without a persistent active state', async ({ page }) => {
  await openEditor(page)

  // The image tool opens the file picker instead of arming a canvas mode,
  // so its button never shows a pressed state — matching Excalidraw.
  const image = page.getByRole('button', { name: 'Image (9)' })
  await expect(image).toHaveAttribute('aria-pressed', 'false')

  const fileChooser = await Promise.all([page.waitForEvent('filechooser'), image.click()])
  const chooser = fileChooser[0]
  expect(await chooser.isMultiple()).toBe(true)
  await expect(image).toHaveAttribute('aria-pressed', 'false')
})
