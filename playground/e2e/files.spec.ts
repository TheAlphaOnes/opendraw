/**
 * Drawing files e2e — the demo's many-drawings system: each drawing keeps
 * its own scene, the open one survives a reload, and the sidebar creates,
 * renames, duplicates, deletes and searches them.
 */
import type { Page } from '@playwright/test'

import { at, canvasBox, drag, openEditor, pickTool, scene, test } from './helpers'
import { expect } from './helpers'

const sidebar = (page: Page) => page.getByRole('dialog', { name: /^Drawings/ })
const row = (page: Page, name: string) => sidebar(page).getByRole('button', { name: new RegExp(`^${name}(?: \\(open\\))?,`) })

async function openSidebar(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Drawings — / }).click()
  await expect(sidebar(page)).toBeVisible()
}

async function drawRectangle(page: Page, x = 160): Promise<void> {
  const box = await canvasBox(page)
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, x, 160), at(box, x + 160, 280))
}

async function rowAction(page: Page, name: string, action: 'Rename' | 'Duplicate' | 'Delete'): Promise<void> {
  await row(page, name).hover()
  await sidebar(page).getByRole('button', { name: `Actions for ${name}` }).click()
  await page.getByRole('menuitem', { name: action }).click()
}

test('each drawing keeps its own scene', async ({ page }) => {
  await openEditor(page)
  await drawRectangle(page)
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)

  await openSidebar(page)
  await sidebar(page).getByRole('button', { name: 'New', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Drawings — Untitled drawing 2' })).toBeVisible()
  await expect.poll(async () => (await scene(page)).elements.length).toBe(0)
  await page.keyboard.press('Escape')

  await drawRectangle(page, 120)
  await drawRectangle(page, 360)
  await expect.poll(async () => (await scene(page)).elements.length).toBe(2)

  await openSidebar(page)
  await row(page, 'Untitled drawing').click()
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  await row(page, 'Untitled drawing 2').click()
  await expect.poll(async () => (await scene(page)).elements.length).toBe(2)
})

test('reopens the open drawing after a reload, with its name', async ({ page }) => {
  await openEditor(page)
  await openSidebar(page)
  await sidebar(page).getByRole('button', { name: 'New', exact: true }).click()
  await rowAction(page, 'Untitled drawing 2', 'Rename')
  const input = sidebar(page).getByRole('textbox', { name: 'Drawing name' })
  await input.fill('Roadmap')
  await input.press('Enter')
  await expect(row(page, 'Roadmap')).toBeVisible()
  await page.keyboard.press('Escape')
  await drawRectangle(page)
  await page.waitForTimeout(800)

  await page.reload()
  await openEditor(page)
  await expect(page.getByRole('button', { name: 'Drawings — Roadmap' })).toBeVisible()
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
})

test('renames with F2 and keeps the old name on Escape', async ({ page }) => {
  await openEditor(page)
  await openSidebar(page)
  await row(page, 'Untitled drawing').focus()
  await page.keyboard.press('F2')
  const input = sidebar(page).getByRole('textbox', { name: 'Drawing name' })
  await input.fill('Scrapped')
  await input.press('Escape')
  await expect(row(page, 'Untitled drawing')).toBeVisible()
  // Escape in the field only cancels the rename; the sidebar stays open.
  await expect(sidebar(page)).toBeVisible()
})

test('duplicates a drawing with its content', async ({ page }) => {
  await openEditor(page)
  await drawRectangle(page)
  await openSidebar(page)
  await rowAction(page, 'Untitled drawing', 'Duplicate')
  await row(page, 'Untitled drawing copy').click()
  await expect(page.getByRole('button', { name: 'Drawings — Untitled drawing copy' })).toBeVisible()
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
})

test('deletes after confirming, then opens the next drawing', async ({ page }) => {
  await openEditor(page)
  await drawRectangle(page)
  await openSidebar(page)
  await sidebar(page).getByRole('button', { name: 'New', exact: true }).click()
  await expect.poll(async () => (await scene(page)).elements.length).toBe(0)

  await rowAction(page, 'Untitled drawing 2', 'Delete')
  const confirm = sidebar(page).getByRole('alertdialog')
  await confirm.getByRole('button', { name: 'Cancel' }).click()
  await expect(row(page, 'Untitled drawing 2')).toBeVisible()

  await rowAction(page, 'Untitled drawing 2', 'Delete')
  await sidebar(page).getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(row(page, 'Untitled drawing 2')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Drawings — Untitled drawing' })).toBeVisible()
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
})

test('searches drawings by name', async ({ page }) => {
  await openEditor(page)
  await openSidebar(page)
  await sidebar(page).getByRole('button', { name: 'New', exact: true }).click()
  const search = sidebar(page).getByRole('searchbox', { name: 'Search drawings' })
  await search.fill('2')
  await expect(row(page, 'Untitled drawing 2')).toBeVisible()
  await expect(row(page, 'Untitled drawing')).toHaveCount(0)
  await search.fill('nothing like this')
  await expect(sidebar(page).getByRole('status')).toContainText('No drawings match')
  // Escape clears the search first, then closes.
  await search.press('Escape')
  await expect(search).toHaveValue('')
  await search.press('Escape')
  await expect(sidebar(page)).toHaveCount(0)
})

test('keys typed in the sidebar never reach the canvas shortcuts', async ({ page }) => {
  await openEditor(page)
  await drawRectangle(page)
  await openSidebar(page)
  await row(page, 'Untitled drawing').focus()
  await page.keyboard.press('r')
  await expect(page.getByRole('button', { name: 'Selection (1)' })).toHaveAttribute('aria-pressed', 'true')
  // Delete on a row asks to delete the drawing, not the selected shape.
  await page.keyboard.press('Delete')
  await expect(sidebar(page).getByRole('alertdialog')).toBeVisible()
  expect((await scene(page)).elements).toHaveLength(1)
})

test('keeps the theme across drawings', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('button', { name: 'Main menu' }).click()
  await page.getByRole('menuitem', { name: /^Dark mode/ }).click()
  await openSidebar(page)
  await sidebar(page).getByRole('button', { name: 'New', exact: true }).click()
  await expect(page.locator('[data-opendraw-root]')).toHaveAttribute('data-theme', 'dark')
  await row(page, 'Untitled drawing').click()
  await expect(page.locator('[data-opendraw-root]')).toHaveAttribute('data-theme', 'dark')
})
