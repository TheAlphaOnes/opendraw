import { fileURLToPath } from 'node:url'

import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

const src = (path: string) => fileURLToPath(new URL(`../../packages/${path}`, import.meta.url))

// The adapter and engine run from their sources, like the playground.
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: [
      { find: /^@opendraw\/core$/, replacement: src('core/src/index.ts') },
      { find: /^@opendraw\/editor$/, replacement: src('editor/src/index.ts') },
      { find: /^@opendraw\/svelte$/, replacement: src('svelte/src/index.ts') },
    ],
  },
  server: { port: 5182, strictPort: true },
})
