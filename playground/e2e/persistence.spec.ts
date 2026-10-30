import {
  at,
  canvasBox,
  drag,
  expect,
  openApp,
  openEditor,
  pickFill,
  pickTool,
  scene,
  test,
  tipOf,
} from './helpers'

/**
 * Automatic scene persistence: the debounced localStorage save under the
 * stable key, and the restore that brings the scene (elements, bindings,
 * theme) back after a reload — without a spurious undo entry.
 */

const STORAGE_KEY = 'opendraw:scene'

test('restores a shape and its bound arrow across a page reload', async ({ page }) => {
  await openEditor(page)
  const box = await canvasBox(page)

  // A filled rectangle...
  await pickFill(page)
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 300, 150), at(box, 480, 270))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  const rectId = (await scene(page)).elements[0]!.id

  // ...and an arrow docked into it.
  await pickTool(page, 'Arrow (5)')
  await drag(page, at(box, 160, 210), at(box, 390, 210))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(2)
  const before = await scene(page)
  const arrowBefore = before.elements.find((el) => el.type === 'arrow')!
  const rectBefore = before.elements.find((el) => el.id === rectId)!
  expect(arrowBefore.endBinding).toMatchObject({ elementId: rectId })

  // Theme rides along in the persisted chrome state.
  await page.getByRole('button', { name: 'Dark theme' }).click()

  // The debounced save lands under the stable key — wait until it reflects
  // everything drawn above (the first save may predate the theme switch).
  await expect
    .poll(async () =>
      page.evaluate((key) => {
        const raw = window.localStorage.getItem(key)
        if (raw === null) {
          return false
        }
        try {
          const parsed: unknown = JSON.parse(raw)
          return (
            typeof parsed === 'object'
            && parsed !== null
            && (parsed as { appState?: { theme?: string } }).appState?.theme === 'dark'
          )
        } catch {
          return false
        }
      }, STORAGE_KEY),
    )
    .toBe(true)

  const stored = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)!), STORAGE_KEY)
  expect(stored.type).toBe('opendraw-scene')
  expect(stored.file.elements).toHaveLength(2)

  // Reload the page.
  await openApp(page, '/')

  // The full scene is back: both elements, with the binding intact.
  await expect.poll(async () => (await scene(page)).elements.length).toBe(2)
  const after = await scene(page)
  const rectAfter = after.elements.find((el) => el.id === rectId)!
  const arrowAfter = after.elements.find((el) => el.id === arrowBefore.id)!
  expect(rectAfter).toEqual(rectBefore)
  expect(arrowAfter.endBinding).toMatchObject({ elementId: rectId })
  expect(tipOf(arrowAfter, 'end')).toEqual(tipOf(arrowBefore, 'end'))

  // The persisted theme is back too.
  await expect(page.locator('.opendraw-root')).toHaveAttribute('data-theme', 'dark')

  // The restore recorded no history: a freshly loaded page cannot undo
  // itself into an empty scene.
  await expect(page.getByRole('button', { name: /^Undo \(/ })).toBeDisabled()
})

test('degrades to a fresh scene on a corrupted payload', async ({ page }) => {
  await page.addInitScript(
    (key) => {
      window.localStorage.setItem(key, '{not json at all')
    },
    STORAGE_KEY,
  )
  await openEditor(page)
  const box = await canvasBox(page)

  // The editor is alive and empty, and new drawing still works (and saves).
  await expect.poll(async () => (await scene(page)).elements.length).toBe(0)
  await pickTool(page, 'Rectangle (2)')
  await drag(page, at(box, 120, 120), at(box, 200, 190))
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
})
