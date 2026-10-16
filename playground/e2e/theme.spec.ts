import { openEditor, pixelAt, settleFrames, test } from './helpers'
import { expect } from './helpers'

test('switches the scene to dark and back', async ({ page }) => {
  await openEditor(page)
  await settleFrames(page)

  expect(await pixelAt(page, 6, 6)).toEqual([255, 255, 255])
  await expect(page.locator('.vuedraw-root')).toHaveAttribute('data-theme', 'light')

  await page.getByRole('button', { name: 'Dark theme' }).click()
  await expect(page.locator('.vuedraw-root')).toHaveAttribute('data-theme', 'dark')
  await settleFrames(page)
  expect(await pixelAt(page, 6, 6)).toEqual([18, 18, 18])

  await page.getByRole('button', { name: 'Light theme' }).click()
  await expect(page.locator('.vuedraw-root')).toHaveAttribute('data-theme', 'light')
  await settleFrames(page)
  expect(await pixelAt(page, 6, 6)).toEqual([255, 255, 255])
})
