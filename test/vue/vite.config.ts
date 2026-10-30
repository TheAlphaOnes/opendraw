import { fileURLToPath } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const src = (path: string) => fileURLToPath(new URL(`../../packages/${path}`, import.meta.url))

// A plain Vue 3 app (no Nuxt) on @opendraw/nuxt/vue, run from sources.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: /^@opendraw\/core$/, replacement: src('core/src/index.ts') },
      { find: /^@opendraw\/editor$/, replacement: src('editor/src/index.ts') },
      { find: /^@opendraw\/nuxt\/vue$/, replacement: src('nuxt/src/runtime/vue.ts') },
    ],
  },
  server: { port: 5183, strictPort: true },
})
