/**
 * SEO e2e, what search engines, social previews and AI assistants read:
 * titles, descriptions, canonical URLs, social cards with absolute images,
 * structured data, robots rules, the sitemap and llms.txt.
 */
import type { Page } from '@playwright/test'

import { test } from './helpers'
import { expect } from './helpers'

const meta = (page: Page, selector: string) => page.locator(selector).first().getAttribute('content')

async function jsonLdTypes(page: Page): Promise<string[]> {
  const raw = await page.locator('script[type="application/ld+json"]').first().textContent()
  const data = JSON.parse(raw ?? '{}') as { '@graph'?: { '@type': string }[] }
  return (data['@graph'] ?? []).map((node) => node['@type'])
}

test('the editor page describes itself to search engines and social cards', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/opendraw: hand-drawn diagrams for Vue, Nuxt, React & Svelte/)
  expect((await meta(page, 'meta[name="description"]'))?.length).toBeGreaterThan(120)
  expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toMatch(/^https?:\/\/[^/]+\/$/)
  expect(await meta(page, 'meta[property="og:image"]')).toMatch(/^https?:\/\/.+\/og\.png$/)
  expect(await meta(page, 'meta[name="twitter:card"]')).toBe('summary_large_image')
  expect(await jsonLdTypes(page)).toEqual(['WebSite', 'WebApplication', 'SoftwareSourceCode'])
  // One heading names the page for screen readers and crawlers.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/opendraw/)
  // The canvas owns pinch zoom: the page itself does not zoom.
  expect(await meta(page, 'meta[name="viewport"]')).toContain('user-scalable=no')
})

test('the docs page has its own card, article data and normal zoom', async ({ page }) => {
  await page.goto('/docs')
  expect(await meta(page, 'meta[property="og:image"]')).toMatch(/\/og-docs\.png$/)
  expect(await meta(page, 'meta[property="og:type"]')).toBe('article')
  expect(await jsonLdTypes(page)).toEqual(['TechArticle', 'BreadcrumbList'])
  expect(await meta(page, 'meta[name="viewport"]')).not.toContain('user-scalable=no')
})

test('test pages stay out of search results', async ({ page }) => {
  await page.goto('/excalidraw')
  expect(await meta(page, 'meta[name="robots"]')).toContain('noindex')
})

test('robots.txt, the sitemap, llms.txt and the social images are served', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text()
  expect(robots).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/)

  const sitemap = await (await request.get('/sitemap.xml')).text()
  expect(sitemap).toContain('<loc>')
  expect(sitemap).toMatch(/\/docs<\/loc>/)

  const llms = await (await request.get('/llms.txt')).text()
  expect(llms.startsWith('# opendraw')).toBe(true)
  expect(llms).toContain('npm install @opendrawjs/nuxt')

  const full = await (await request.get('/llms-full.txt')).text()
  for (const name of ['nuxt', 'react', 'svelte', 'editor', 'core']) {
    expect(full).toContain(`# @opendrawjs/${name}`)
  }

  for (const image of ['/og.png', '/og-docs.png', '/apple-touch-icon.png', '/icon-512.png']) {
    const response = await request.get(image)
    expect(response.ok(), image).toBe(true)
    expect(response.headers()['content-type']).toBe('image/png')
  }
  expect((await request.get('/manifest.webmanifest')).ok()).toBe(true)
})

test('the About page explains the product, with FAQ data matching what is shown', async ({ page }) => {
  await page.goto('/about')
  await expect(page).toHaveTitle(/^About opendraw/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A whiteboard you can make your own')
  expect(await jsonLdTypes(page)).toEqual(['AboutPage', 'FAQPage', 'BreadcrumbList'])
  const raw = await page.locator('script[type="application/ld+json"]').first().textContent()
  const faq = (JSON.parse(raw ?? '{}') as { '@graph': { '@type': string; mainEntity?: { name: string }[] }[] })['@graph'].find(
    (node) => node['@type'] === 'FAQPage',
  )!
  const shown = await page.locator('.faq__question').allTextContents()
  expect(faq.mainEntity!.map((q) => q.name)).toEqual(shown.map((text) => text.trim()))
  // The About page is reachable from the site navigation.
  await expect(page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'About' })).toHaveClass(/is-current/)
})

test('every docs topic is its own page, with its own title, heading and canonical URL', async ({ page }) => {
  const paths = ['/docs/opendraw-app', '/docs/component', '/docs/composables', '/docs/react-svelte', '/docs/packages', '/docs/adapters']
  for (const path of paths) {
    await page.goto(path)
    await expect(page).toHaveTitle(/\| opendraw docs$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toMatch(new RegExp(`${path}$`))
  }
  // The sidebar and the next-page link move between pages.
  await page.goto('/docs')
  await page.getByRole('navigation', { name: 'More documentation' }).getByRole('link', { name: /Next/ }).click()
  await expect(page).toHaveURL(/\/docs\/opendraw-app$/)
})

test('the sitemap lists the About page and every docs page', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text()
  for (const path of ['/about', '/docs', '/docs/component', '/docs/react-svelte', '/docs/adapters']) {
    expect(sitemap).toContain(`${path}</loc>`)
  }
})

test('links to old one-page docs anchors land on the new page', async ({ page }) => {
  await page.goto('/docs#svelte')
  await expect(page).toHaveURL(/\/docs\/react-svelte#svelte$/)
  await expect(page.locator('#svelte')).toBeVisible()
})

test('an unknown docs page is a real 404', async ({ request }) => {
  expect((await request.get('/docs/no-such-page')).status()).toBe(404)
})

test('the Docs link stays marked on every docs page', async ({ page }) => {
  await page.goto('/docs/component')
  await expect(page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Docs' })).toHaveAttribute('aria-current', 'page')
})
