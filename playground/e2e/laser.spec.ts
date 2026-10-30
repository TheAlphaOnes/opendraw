import { at, canvasBox, expect, nonTransparentPixels, openEditor, pickTool, scene, settleFrames, test } from './helpers'

/**
 * The laser is overlay ink only (Excalidraw's LaserTrails): one filled,
 * tapered outline that decays away about a second after the pointer stops.
 */
test.describe('laser pointer', () => {
  test('draws a fading trail and never touches the document', async ({ page }) => {
    await openEditor(page)
    const box = await canvasBox(page)
    await pickTool(page, 'Laser (K)')
    const start = at(box, 100, 200)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    for (let i = 1; i <= 30; i++) {
      const p = at(box, 100 + i * 12, 200 + Math.sin(i / 4) * 60)
      await page.mouse.move(p.x, p.y)
    }
    await settleFrames(page)
    const inked = await nonTransparentPixels(page, 'opendraw-canvas__overlay')
    expect(inked).toBeGreaterThan(200)
    await page.mouse.up()
    await expect.poll(() => nonTransparentPixels(page, 'opendraw-canvas__overlay'), { timeout: 3000 }).toBe(0)
    expect((await scene(page)).elements).toHaveLength(0)
  })
})
