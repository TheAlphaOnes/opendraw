import { defineConfig } from '@playwright/test'

/**
 * One suite, two adapters: every spec runs against the React and the
 * Svelte test apps, so both stay behaviorally identical.
 */
export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  reporter: 'list',
  use: { trace: 'retain-on-failure', viewport: { width: 1280, height: 800 } },
  projects: [
    { name: 'react', use: { baseURL: 'http://localhost:5181' } },
    { name: 'svelte', use: { baseURL: 'http://localhost:5182' } },
  ],
  webServer: [
    {
      command: 'pnpm --filter opendraw-test-react dev',
      url: 'http://localhost:5181',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter opendraw-test-svelte dev',
      url: 'http://localhost:5182',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
})
