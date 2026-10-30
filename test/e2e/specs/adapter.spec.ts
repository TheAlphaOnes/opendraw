import { expect, test, type Page } from '@playwright/test'

/**
 * The adapter contract: the React and Svelte packages must render the
 * same editor — toolbar, drawing, shortcuts, text, history, zoom, theme
 * and autosave — on top of @opendraw/editor.
 */

interface Mirror {
  elements: Array<{ type: string; text?: string }>
  theme: string
}

async function open(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.goto('/')
  // Hydrated once the canvas has its real size (it starts at 300x150).
  await page.waitForFunction(() => (document.querySelector<HTMLCanvasElement>('canvas.opendraw__static')?.width ?? 0) > 300)
}

async function mirror(page: Page): Promise<Mirror> {
  return page.evaluate(() => (window as unknown as { __opendraw?: Mirror }).__opendraw ?? { elements: [], theme: 'light' })
}

async function drag(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  await page.mouse.move(...from)
  await page.mouse.down()
  await page.mouse.move(...to, { steps: 8 })
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => {
    throw error
  })
  await open(page)
})

test('renders the toolbar with every tool and its key hint', async ({ page }) => {
  const toolbar = page.getByRole('toolbar', { name: 'Drawing tools' })
  // The tool lock plus every tool in the editor's table.
  await expect(toolbar.getByRole('button')).toHaveCount(15)
  await expect(toolbar.getByRole('button', { name: 'Selection (1)' })).toHaveAttribute('aria-pressed', 'true')
  await expect(toolbar.getByRole('button', { name: 'Rectangle (2)' })).toContainText('2')
  await expect(toolbar.getByRole('button', { name: 'Sticky note (N)' })).toContainText('N')
})

test('draws a rectangle with the toolbar and selects it', async ({ page }) => {
  await page.getByRole('button', { name: 'Rectangle (2)' }).click()
  await drag(page, [400, 300], [600, 420])
  await expect.poll(async () => (await mirror(page)).elements.map((el) => el.type)).toEqual(['rectangle'])
  // One use, then the tool reverts to selection (Excalidraw).
  await expect(page.getByRole('button', { name: 'Selection (1)' })).toHaveAttribute('aria-pressed', 'true')
})

test('arms tools from the keyboard', async ({ page }) => {
  await page.locator('.opendraw__host').click({ position: { x: 900, y: 600 } })
  await page.keyboard.press('o')
  await expect(page.getByRole('button', { name: 'Ellipse (4)' })).toHaveAttribute('aria-pressed', 'true')
  await drag(page, [400, 300], [560, 420])
  await expect.poll(async () => (await mirror(page)).elements.map((el) => el.type)).toEqual(['ellipse'])
})

test('edits text in place', async ({ page }) => {
  await page.getByRole('button', { name: 'Text (T)' }).click()
  await page.mouse.click(500, 350)
  const editor = page.getByRole('textbox', { name: 'Text editor' })
  await expect(editor).toBeFocused()
  await page.keyboard.type('Hello adapters')
  await page.keyboard.press('Escape')
  await expect.poll(async () => (await mirror(page)).elements[0]?.text).toBe('Hello adapters')
})

test('undoes and redoes from the history island', async ({ page }) => {
  const undo = page.getByRole('button', { name: 'Undo' })
  const redo = page.getByRole('button', { name: 'Redo' })
  await expect(undo).toBeDisabled()
  await page.getByRole('button', { name: 'Diamond (3)' }).click()
  await drag(page, [400, 300], [560, 420])
  await expect(undo).toBeEnabled()
  await undo.click()
  await expect.poll(async () => (await mirror(page)).elements.length).toBe(0)
  await redo.click()
  await expect.poll(async () => (await mirror(page)).elements.length).toBe(1)
})

test('zooms from the zoom island and resets', async ({ page }) => {
  const readout = page.getByRole('button', { name: /reset zoom/i })
  await expect(readout).toHaveText('100%')
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(readout).toHaveText('125%')
  await readout.click()
  await expect(readout).toHaveText('100%')
})

test('switches theme', async ({ page }) => {
  const root = page.locator('.opendraw')
  await page.getByRole('button', { name: 'Dark mode' }).click()
  await expect(root).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Light mode' }).click()
  await expect(root).toHaveAttribute('data-theme', 'light')
})

test('autosaves and restores the scene', async ({ page }) => {
  await page.getByRole('button', { name: 'Rectangle (2)' }).click()
  await drag(page, [400, 300], [600, 420])
  await expect.poll(async () => (await mirror(page)).elements.length).toBe(1)
  // The debounced save (300ms) lands before the reload reads it back.
  await page.waitForTimeout(600)
  await page.reload()
  await page.waitForFunction(() => (document.querySelector<HTMLCanvasElement>('canvas.opendraw__static')?.width ?? 0) > 300)
  await expect.poll(async () => (await mirror(page)).elements.map((el) => el.type)).toEqual(['rectangle'])
})
