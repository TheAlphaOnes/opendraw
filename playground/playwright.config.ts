import { defineConfig, devices } from '@playwright/test'

/**
 * E2E suite for the playground app.
 *
 * The webServer boots the documented dev entrypoint (`pnpm dev` at the repo
 * root — it builds the workspace packages first, then serves the playground),
 * so a fresh clone runs the suite with no manual setup. Specs drive the real
 * UI: tool clicks, pointer drags, undo, theme, the wysiwyg text editor.
 *
 * Pixel probes must run after a frame settles — renders are rAF-coalesced
 * (see helpers.settleFrames).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    cwd: '..',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
