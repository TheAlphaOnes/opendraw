import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const src = (path: string) => fileURLToPath(new URL(`../../packages/${path}`, import.meta.url))

// The adapter and engine run from their TypeScript sources, like the playground.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@opendrawjs\/core$/, replacement: src('core/src/index.ts') },
      { find: /^@opendrawjs\/editor$/, replacement: src('editor/src/index.ts') },
      { find: /^@opendrawjs\/react$/, replacement: src('react/src/index.ts') },
    ],
  },
  server: { port: 5181, strictPort: true },
})
