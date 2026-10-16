import { at, canvasBox, drag, openApp, test } from './helpers'
import { expect } from './helpers'

test('the headless page draws through its own dock', async ({ page }) => {
  await openApp(page, '/headless')

  // The page owns all chrome; the context-driven dock must drive the same
  // document the canvas renders.
  const undo = page.getByRole('button', { name: 'undo', exact: true })
  await expect(undo).toBeDisabled()

  const box = await canvasBox(page)
  await page.getByRole('button', { name: 'rect', exact: true }).click()
  await drag(page, at(box, 300, 120), at(box, 420, 200))
  await expect(undo).toBeEnabled()

  await undo.click()
  await expect(undo).toBeDisabled()
})
