/**
 * Regenerates the site's and the READMEs' images from the live demo, so
 * they always show the real, current editor:
 *
 *   docs/assets/screenshot.png, screenshot-dark.png   README and npm pages
 *   playground/public/og.png, og-docs.png             social previews (1200x630)
 *   playground/public/apple-touch-icon.png, icon-192.png, icon-512.png, favicon-32.png
 *
 * Run the demo first (`pnpm dev`), then: `pnpm --filter opendraw-playground assets`.
 * BASE_URL overrides http://localhost:3000.
 */
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const out = {
  docs: resolve(root, 'docs/assets'),
  public: resolve(root, 'playground/public'),
}
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'

const dataUrl = async (path, type) => `data:${type};base64,${(await readFile(path)).toString('base64')}`

// ---------------------------------------------------------------------------
// The demo scene, drawn through the real UI
// ---------------------------------------------------------------------------

async function drawScene(page) {
  const canvas = page.locator('canvas.opendraw-canvas__static')
  const box = await canvas.boundingBox()
  const at = (x, y) => ({ x: box.x + x, y: box.y + y })
  const drag = async (from, to) => {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 12 })
    await page.mouse.up()
  }
  const tool = (name) => page.getByRole('button', { name, exact: true }).click()
  const fill = (hex) => page.getByRole('radio', { name: hex }).first().check()

  const shape = async (name, from, to, color, label) => {
    await tool(name)
    await drag(at(from[0], from[1]), at(to[0], to[1]))
    // Label first: picking a color moves focus to the panel, where Enter
    // would press the swatch instead of opening the label editor.
    await page.keyboard.press('Enter')
    await page.keyboard.type(label)
    await page.keyboard.press('Escape')
    await fill(color)
    await page.keyboard.press('Escape')
  }

  await shape('Rectangle (2)', [380, 330], [560, 430], '#ffc9c9', 'Sketch')
  await shape('Rectangle (2)', [660, 330], [840, 430], '#a5d8ff', 'Share')
  await shape('Ellipse (4)', [930, 320], [1090, 440], '#b2f2bb', 'Ship')

  // Arrows from shape to shape: each tip starts just outside an outline,
  // so it binds to the outline rather than inside the shape.
  for (const [from, to] of [[[568, 380], [652, 380]], [[848, 380], [922, 380]]]) {
    await tool('Arrow (5)')
    await drag(at(from[0], from[1]), at(to[0], to[1]))
  }

  await tool('Sticky note (N)')
  await page.mouse.click(at(560, 610).x, at(560, 610).y)
  await page.keyboard.type('Hand-drawn diagrams for Vue, React & Svelte')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')

  // Name the drawing, as a user would.
  await page.getByRole('button', { name: /^Drawings — / }).click()
  await page.locator('.file-item__open').first().focus()
  await page.keyboard.press('F2')
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Product flow')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await page.mouse.click(at(1300, 760).x, at(1300, 760).y)
  await page.waitForTimeout(600)
}

async function captureScreenshots(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 } })
  await page.goto(BASE_URL)
  await page.evaluate(() => localStorage.clear())
  await page.goto(BASE_URL)
  await page.waitForFunction(() => (document.querySelector('canvas.opendraw-canvas__static')?.width ?? 0) > 300)
  await drawScene(page)
  await page.mouse.move(1439, 859)
  await page.screenshot({ path: resolve(out.docs, 'screenshot.png') })

  await page.getByRole('button', { name: 'Main menu' }).click()
  await page.getByRole('menuitem', { name: /^Dark mode/ }).click()
  await page.mouse.click(1300, 760)
  await page.mouse.move(1439, 859)
  await page.waitForTimeout(400)
  await page.screenshot({ path: resolve(out.docs, 'screenshot-dark.png') })
  await page.close()
}

// ---------------------------------------------------------------------------
// Social previews and icons, composed in HTML
// ---------------------------------------------------------------------------

async function ogTemplate({ eyebrow, title, subtitle, chips }) {
  const [assistant, assistantBold, excalifont, logo, shot] = await Promise.all([
    dataUrl(resolve(root, 'packages/nuxt/src/runtime/assets/fonts/Assistant-Regular.woff2'), 'font/woff2'),
    dataUrl(resolve(root, 'packages/nuxt/src/runtime/assets/fonts/Assistant-SemiBold.woff2'), 'font/woff2'),
    dataUrl(resolve(root, 'packages/editor/styles/fonts/Excalifont-latin.woff2'), 'font/woff2'),
    dataUrl(resolve(root, 'docs/assets/logo.svg'), 'image/svg+xml'),
    dataUrl(resolve(out.docs, 'screenshot.png'), 'image/png'),
  ])
  return `<!doctype html><html><head><style>
    @font-face { font-family: Assistant; font-weight: 400; src: url(${assistant}) format('woff2'); }
    @font-face { font-family: Assistant; font-weight: 600; src: url(${assistantBold}) format('woff2'); }
    @font-face { font-family: Excalifont; src: url(${excalifont}) format('woff2'); }
    * { box-sizing: border-box; margin: 0; }
    body { width: 1200px; height: 630px; overflow: hidden; font-family: Assistant, sans-serif; color: #1b1b1f;
      background: #fffaf6; position: relative; }
    .grid { position: absolute; inset: 0; background-image: radial-gradient(#e9d9cd 1.2px, transparent 1.2px);
      background-size: 22px 22px; opacity: .7; }
    .copy { position: absolute; left: 72px; top: 76px; width: 560px; }
    .logo { height: 54px; display: block; }
    .eyebrow { margin-top: 40px; font-size: 20px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #ea580c; }
    h1 { margin-top: 12px; font-family: Excalifont, cursive; font-weight: 400; font-size: 52px; line-height: 1.12; }
    p { margin-top: 18px; font-size: 25px; line-height: 1.35; color: #55555d; }
    .chips { margin-top: 30px; display: flex; flex-wrap: wrap; gap: 10px; }
    .chip { padding: 8px 14px; border-radius: 999px; background: #fff; box-shadow: 0 0 0 1px #f1dccd; font-size: 19px; font-weight: 600; }
    .shot { position: absolute; left: 640px; top: 92px; width: 640px; border-radius: 14px; overflow: hidden;
      box-shadow: 0 0 0 1px rgba(0,0,0,.06), 0 24px 60px -12px rgba(124,45,18,.28); transform: rotate(-2deg); }
    .shot img { display: block; width: 100%; }
  </style></head><body>
    <div class="grid"></div>
    <div class="copy">
      <img class="logo" src="${logo}" alt="">
      <div class="eyebrow">${eyebrow}</div>
      <h1>${title}</h1>
      <p>${subtitle}</p>
      <div class="chips">${chips.map((c) => `<span class="chip">${c}</span>`).join('')}</div>
    </div>
    <div class="shot"><img src="${shot}" alt=""></div>
  </body></html>`
}

async function captureOg(browser) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  const variants = [
    {
      file: 'og.png',
      eyebrow: 'Open source · MIT',
      title: 'Hand-drawn diagrams, right in your app',
      subtitle: 'An Excalidraw-style whiteboard as one component.',
      chips: ['Vue & Nuxt', 'React', 'Svelte', 'TypeScript'],
    },
    {
      file: 'og-docs.png',
      eyebrow: 'Documentation',
      title: 'Add a whiteboard in one line',
      subtitle: 'Install, props, composables and theming.',
      chips: ['@opendrawjs/nuxt', '@opendrawjs/react', '@opendrawjs/svelte'],
    },
  ]
  for (const variant of variants) {
    await page.setContent(await ogTemplate(variant))
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: resolve(out.public, variant.file) })
  }
  await page.close()
}

async function captureIcons(browser) {
  const favicon = await dataUrl(resolve(out.public, 'favicon.svg'), 'image/svg+xml')
  const sizes = [
    ['apple-touch-icon.png', 180, 0],
    ['icon-192.png', 192, 0],
    ['icon-512.png', 512, 0],
    // Maskable-safe: the mark sits inside the central 80% circle.
    ['icon-maskable-512.png', 512, 0.12],
    ['favicon-32.png', 32, 0],
  ]
  for (const [file, size, inset] of sizes) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    const pad = Math.round(size * inset)
    await page.setContent(`<html><body style="margin:0;background:${inset ? '#ea580c' : 'transparent'}">
      <img src="${favicon}" style="display:block;width:${size - pad * 2}px;height:${size - pad * 2}px;margin:${pad}px"></body></html>`)
    await page.screenshot({ path: resolve(out.public, file), omitBackground: !inset })
    await page.close()
  }
}

const browser = await chromium.launch()
try {
  await captureScreenshots(browser)
  await captureOg(browser)
  await captureIcons(browser)
  console.log('assets written to docs/assets and playground/public')
} finally {
  await browser.close()
}
