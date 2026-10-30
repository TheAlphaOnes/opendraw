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

  app: {
    head: {
      title: 'opendraw',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
})
