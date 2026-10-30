/**
 * Toolbar e2e — the top-center tool island must match Excalidraw's
 * arrangement: the full tool set, in Excalidraw's order, split into the
 * same groups (tool lock | hand+selection | shapes |
 * freedraw/text/image/eraser | frame/laser).
 */
import type { Page } from '@playwright/test'

import { expect, openEditor, test } from './helpers'

/** Excalidraw's island order, one entry per dock button. */
const TOOL_LOCK = 'Keep selected tool active after drawing (Q)'

const TOOL_ORDER = [
  TOOL_LOCK,
  'Hand (H)',
  'Selection (1)',
  'Rectangle (2)',
  'Diamond (3)',
  'Ellipse (4)',
  'Arrow (5)',
  'Line (6)',
  'Freedraw (P)',
  'Text (T)',
  'Image (9)',
  'Eraser (E)',
  'Frame (F)',
  'Laser (K)',
] as const

/** Excalidraw's visual groups, separated by dividers in the island. */
const TOOL_GROUPS: ReadonlyArray<readonly string[]> = [
  [TOOL_LOCK],
  ['Hand (H)', 'Selection (1)'],
  ['Rectangle (2)', 'Diamond (3)', 'Ellipse (4)', 'Arrow (5)', 'Line (6)'],
  ['Freedraw (P)', 'Text (T)', 'Image (9)', 'Eraser (E)'],
  ['Frame (F)', 'Laser (K)'],
]

function groupMembers(index: number): readonly string[] {
  const members = TOOL_GROUPS[index]
  if (!members) {
    throw new Error(`no expected members for group ${index}`)
  }
  return members
}

async function dockBox(page: Page): Promise<{ x: number; y: number; width: number }> {
  const box = await page.locator('.tool-dock').boundingBox()
  if (!box) {
    throw new Error('tool dock did not render')
  }
  return box
}

test('renders every tool in the top-center island in Excalidraw order', async ({ page }) => {
  await openEditor(page)

  const dock = page.getByRole('toolbar', { name: 'Drawing tools' })
  await expect(dock).toBeVisible()

  // DOM order of the accessible names must equal Excalidraw's island order.
  const labels = await dock.getByRole('button').evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute('aria-label')),
  )
  expect(labels).toEqual([...TOOL_ORDER])

  // The island sits at the top, horizontally centered on the viewport.
  const viewport = page.viewportSize()
  if (!viewport) {
    throw new Error('viewport size unavailable')
  }
  const box = await dockBox(page)
  expect(box.y).toBeLessThan(64)
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2)
})

test('splits the tools into Excalidraw groups separated by dividers', async ({ page }) => {
  await openEditor(page)

  const groups = page.locator('.tool-dock__group')
  await expect(groups).toHaveCount(TOOL_GROUPS.length)

  // Each group holds exactly its expected members, in order, and the
  // groups themselves run left to right across the island.
  const groupBoxes: Array<{ x: number; right: number }> = []
  for (let index = 0; index < TOOL_GROUPS.length; index += 1) {
    const group = groups.nth(index)
    const labels = await group.getByRole('button').evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute('aria-label')),
    )
    expect(labels).toEqual([...groupMembers(index)])

    const box = await group.boundingBox()
    if (!box) {
      throw new Error(`group ${index} did not render`)
    }
    groupBoxes.push({ x: box.x, right: box.x + box.width })
  }
  for (let index = 1; index < groupBoxes.length; index += 1) {
    const previous = groupBoxes[index - 1]
    const current = groupBoxes[index]
    if (!previous || !current) {
      throw new Error(`group ${index} missing a bounding box`)
    }
    expect(current.x).toBeGreaterThan(previous.right)
  }
})

test('starts on selection and marks the clicked tool active', async ({ page }) => {
  await openEditor(page)

  const selection = page.getByRole('button', { name: 'Selection (1)' })
  const rectangle = page.getByRole('button', { name: 'Rectangle (2)' })

  await expect(selection).toHaveAttribute('aria-pressed', 'true')
  await expect(rectangle).toHaveAttribute('aria-pressed', 'false')

  await rectangle.click()
  await expect(rectangle).toHaveAttribute('aria-pressed', 'true')
  await expect(selection).toHaveAttribute('aria-pressed', 'false')

  await selection.click()
  await expect(selection).toHaveAttribute('aria-pressed', 'true')
  await expect(rectangle).toHaveAttribute('aria-pressed', 'false')
})

test('keeps the image insertion gesture without a persistent active state', async ({ page }) => {
  await openEditor(page)

  // The image tool opens the file picker instead of arming a canvas mode,
  // so its button never shows a pressed state — matching Excalidraw.
  const image = page.getByRole('button', { name: 'Image (9)' })
  await expect(image).toHaveAttribute('aria-pressed', 'false')

  const fileChooser = await Promise.all([page.waitForEvent('filechooser'), image.click()])
  const chooser = fileChooser[0]
  expect(await chooser.isMultiple()).toBe(true)
  await expect(image).toHaveAttribute('aria-pressed', 'false')
})
