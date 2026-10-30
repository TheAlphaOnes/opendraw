import { openEditor, pixelAt, settleFrames, test } from './helpers'
import { expect } from './helpers'

/**
 * First-load theme resolution (Excalidraw parity), pinned against a browser
 * emulating `prefers-color-scheme: dark`: no persisted scene means the
 * system wins; a scene the user saved (with its theme) wins over the
 * system, whichever way each points.
 */
test.describe('system dark color scheme', () => {
  test.use({ colorScheme: 'dark' })

  test('opens in the dark theme with no persisted scene', async ({ page }) => {
    await openEditor(page)
    await settleFrames(page)

    await expect(page.locator('.opendraw-root')).toHaveAttribute('data-theme', 'dark')
    expect(await pixelAt(page, 6, 6)).toEqual([18, 18, 18])
  })

  test('a persisted light theme still wins over the system default', async ({ page }) => {
    // First visit with a dark system: the editor opens dark, then the user
    // explicitly switches to light — that choice is persisted.
    await openEditor(page)
    await page.getByRole('button', { name: 'Light theme' }).click()
    await expect(page.locator('.opendraw-root')).toHaveAttribute('data-theme', 'light')

    // The debounced save (300ms) must land before the reload reads it back.
    await page.waitForTimeout(600)
    await page.reload()
    await openEditor(page)

    await expect(page.locator('.opendraw-root')).toHaveAttribute('data-theme', 'light')
  })
})
