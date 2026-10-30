/**
 * Fonts e2e — "Hand-drawn" text draws in Excalifont on every machine: the
 * font ships with the package (no reliance on a cursive font the device may
 * or may not have), loads for canvas text, and text measured before it
 * arrived is re-measured.
 */
import type { Page } from '@playwright/test'

import { at, canvasBox, openEditor, pickTool, scene, test } from './helpers'
import { expect } from './helpers'

const excalifontReady = (page: Page, text: string) =>
  page.evaluate((sample) => document.fonts.check('20px Excalifont', sample), text)

test('ships Excalifont and loads it for hand-drawn canvas text', async ({ page }) => {
  const fontFiles: string[] = []
  page.on('response', (response) => {
    if (/Excalifont-[a-z-]+\.woff2/.test(response.url()) && response.ok()) {
      fontFiles.push(response.url())
    }
  })
  await openEditor(page)
  const box = await canvasBox(page)
  await pickTool(page, 'Text (T)')
  { const p = at(box, 300, 300); await page.mouse.click(p.x, p.y) }
  await page.keyboard.type('Hello Excalifont')
  await page.keyboard.press('Escape')

  await expect.poll(() => excalifontReady(page, 'Hello Excalifont')).toBe(true)
  expect(fontFiles.some((url) => url.includes('Excalifont-latin.woff2'))).toBe(true)
  // Only the subsets the text needs: no Cyrillic or Greek for Latin text.
  expect(fontFiles.some((url) => /cyrillic|greek/.test(url))).toBe(false)
})

test('loads the subset a script needs when such text appears', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)
  await pickTool(page, 'Text (T)')
  { const p = at(box, 300, 300); await page.mouse.click(p.x, p.y) }
  await page.keyboard.type('Привет')
  await page.keyboard.press('Escape')
  await expect.poll(() => excalifontReady(page, 'Привет')).toBe(true)
})

test('a restored scene is measured with Excalifont after a reload', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)
  await pickTool(page, 'Text (T)')
  { const p = at(box, 300, 300); await page.mouse.click(p.x, p.y) }
  await page.keyboard.type('Measured right')
  await page.keyboard.press('Escape')
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  await page.waitForTimeout(600)

  await page.reload()
  await openEditor(page)
  await expect.poll(() => excalifontReady(page, 'Measured right')).toBe(true)
  const expected = await page.evaluate(() => {
    const context = document.createElement('canvas').getContext('2d')!
    context.font = '20px Excalifont'
    return context.measureText('Measured right').width
  })
  await expect.poll(async () => Math.round((await scene(page)).elements[0]!.width as number)).toBe(Math.round(expected))
})
