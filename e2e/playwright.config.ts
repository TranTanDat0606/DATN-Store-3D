import { defineConfig } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Read-only E2E smoke config (Gate W2.2 — Phase 2).
 *
 * Topology (explicit, no proxy assumptions):
 *  - API:    scripts/e2e-start.mjs on http://127.0.0.1:5005 (owns a disposable
 *            in-memory MongoDB, seeds it, then boots the real Express server).
 *  - Client: production build (`vite build --mode e2e`, VITE_API_URL baked to
 *            the absolute API URL) served by `vite preview` on
 *            http://127.0.0.1:3108. Cross-origin is intentional and verified
 *            explicitly in api-routing.spec.ts — we do NOT rely on vite
 *            preview proxying like vite dev does.
 *  - No order creation, no payment, no webhook simulation in this gate.
 */

const e2eDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(e2eDir, '..')

export default defineConfig({
  testDir: e2eDir,
  testMatch: 'specs/**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3108',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node scripts/e2e-start.mjs',
      url: 'http://127.0.0.1:5005/api/health',
      cwd: repoRoot,
      reuseExistingServer: false, // never reuse: the runner must own a fresh DB
      timeout: 300_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run build:e2e && npm run preview:e2e',
      url: 'http://127.0.0.1:3108',
      cwd: path.join(repoRoot, 'client'),
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
})
