export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',

  modules: ['@opendraw/nuxt'],

  // Dev DX: alias the engine and editor to their TypeScript sources so
  // playground edits are live. The built module still consumes their dists.
  vite: {
    resolve: {
      alias: {
        '@opendraw/core': '../packages/core/src/index.ts',
        '@opendraw/editor': '../packages/editor/src/index.ts',
      },
    },
    optimizeDeps: {
      include: ['lucide-vue-next', 'perfect-freehand', 'roughjs'],
    },
  },

  devtools: { enabled: false },

  app: {
    head: {
      title: 'opendraw — playground',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
})
