import { canvasBox, openApp, settleFrames, test } from './helpers'
import { expect } from './helpers'

test('the /excalidraw demo renders a console-clean full-viewport canvas', async ({ page }) => {
  // The shared test fixture fails this spec on any browser console error
  // or unhandled page error, so reaching the assertions is itself the
  // no-errors check for the route and its initial render.
  await openApp(page, '/excalidraw')
  await settleFrames(page)

  const box = await canvasBox(page)
  const view = page.viewportSize()
  expect(box.width).toBeGreaterThan(view!.width * 0.95)
  expect(box.height).toBeGreaterThan(view!.height * 0.95)

  // The full chrome is mounted on the demo route too.
  await expect(page.locator('.zoom-controls')).toBeVisible()
})
