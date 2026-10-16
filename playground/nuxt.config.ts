export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',

  modules: ['vuedraw'],

  // Dev DX: alias the engine to its TypeScript source so playground edits are live.
  // The built module still consumes @vuedraw/core's dist in published form.
  vite: {
    resolve: {
      alias: {
        '@vuedraw/core': '../packages/core/src/index.ts',
      },
    },
  },

  devtools: { enabled: false },

  app: {
    head: {
      title: 'vuedraw — playground',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
})
