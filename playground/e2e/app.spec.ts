import { expect, openEditor, test } from './helpers'

/**
 * <OpenDrawApp> — the demo site as one configured component: the copyable
 * command and the docs link top-right, all sharing the 40px island bar.
 */
test.describe('<OpenDrawApp>', () => {
  test('copies the install command and confirms it', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.setViewportSize({ width: 1440, height: 860 })
    await openEditor(page)
    const copy = page.getByRole('button', { name: 'Copy: npm install @opendraw/nuxt' })
    await copy.click()
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('npm install @opendraw/nuxt')
  })

  test('lines every top-row control up on one 40px bar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 860 })
    await openEditor(page)
    const boxes = await Promise.all(
      [
        page.getByRole('button', { name: 'Main menu' }),
        page.locator('.tool-dock'),
        page.locator('.od-command'),
        page.getByRole('link', { name: 'Docs' }),
      ].map((locator) => locator.boundingBox()),
    )
    for (const box of boxes) {
      expect(box?.y).toBe(boxes[0]?.y)
      expect(box?.height).toBe(40)
    }
  })

  test('the Docs link opens the documentation', async ({ page }) => {
    await openEditor(page)
    await page.getByRole('link', { name: 'Docs' }).click()
    await expect(page).toHaveURL(/\/docs$/)
    await expect(page.getByRole('heading', { name: 'opendraw', level: 1 })).toBeVisible()
  })

  test('on phones a labelled Install button reveals the command', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 700 })
    await openEditor(page)
    await page.getByRole('button', { name: 'Install: npm install @opendraw/nuxt' }).click()
    const card = page.getByRole('dialog', { name: 'Install' })
    await expect(card).toContainText('npm install @opendraw/nuxt')
    await expect(card.getByRole('button', { name: 'Copy command' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(card).toBeHidden()
  })

  for (const width of [320, 390]) {
    test(`the phone toolbar fits ${width}px without scrolling`, async ({ page }) => {
      await page.setViewportSize({ width, height: 760 })
      await openEditor(page)
      const fit = await page.locator('.tool-dock').evaluate((el) => el.scrollWidth - el.clientWidth)
      expect(fit).toBe(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0)
      // The tools that step aside on phones are one tap away in "More tools".
      await page.getByRole('button', { name: 'More tools' }).click()
      await page.getByRole('menuitem', { name: /^Diamond/ }).click()
      await expect(page.getByRole('button', { name: 'More tools' })).toHaveAttribute('aria-pressed', 'true')
    })
  }
})
