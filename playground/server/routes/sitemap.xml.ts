/** The pages worth indexing: the editor and the documentation. */
const PAGES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/docs', priority: '0.8', changefreq: 'weekly' },
] as const

export default defineEventHandler((event) => {
  const base = useRuntimeConfig(event).public.siteUrl as string
  const lastmod = new Date().toISOString().slice(0, 10)
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  const urls = PAGES.map(
    (page) =>
      `  <url>\n    <loc>${siteUrl(base, page.path)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>`,
  )
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
})
