/**
 * The public origin, for canonical URLs, social cards, the sitemap and
 * llms.txt, all of which need absolute URLs. Set NUXT_PUBLIC_SITE_URL for
 * a custom domain; on Vercel the production domain is picked up
 * automatically.
 */
const siteUrl = (
  process.env.NUXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')
).replace(/\/$/, '')

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',

  modules: ['@opendrawjs/nuxt'],

  // Dev DX: alias the engine and editor to their TypeScript sources so
  // playground edits are live. The built module still consumes their dists.
  vite: {
    resolve: {
      // Exact matches only: subpaths such as @opendrawjs/editor/fonts.css
      // must still resolve through the package's exports.
      alias: [
        { find: /^@opendrawjs\/core$/, replacement: '../packages/core/src/index.ts' },
        { find: /^@opendrawjs\/editor$/, replacement: '../packages/editor/src/index.ts' },
      ],
    },
    optimizeDeps: {
      include: ['lucide-vue-next', 'perfect-freehand', 'roughjs'],
    },
  },

  devtools: { enabled: false },

  runtimeConfig: {
    public: { siteUrl },
  },

  // The machine-readable files are generated with the site, as static files.
  nitro: {
    prerender: {
      routes: ['/about', '/sitemap.xml', '/robots.txt', '/llms.txt', '/llms-full.txt'],
      // Every docs page is linked from the docs sidebar, so the crawler finds them all.
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'opendraw',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'application-name', content: 'opendraw' },
        { name: 'apple-mobile-web-app-title', content: 'opendraw' },
        { name: 'author', content: 'Vishnu' },
        { name: 'color-scheme', content: 'light dark' },
        { name: 'theme-color', content: '#ffffff', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#121212', media: '(prefers-color-scheme: dark)' },
        { name: 'format-detection', content: 'telephone=no' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
      ],
    },
  },
})
