/**
 * E2E runner (Gate W2.2 — Phase 3).
 *
 * SAFETY MODEL (fail closed):
 *  - The runner CREATES and OWNS a disposable in-memory MongoDB
 *    (mongodb-memory-server). A fresh instance + unique port per run.
 *  - If TEST_DATABASE_URL is set in the environment the runner REFUSES to
 *    start: external database URLs are never used for destructive seed
 *    operations, and seed --fresh never runs against a pre-existing database.
 *  - Production credentials are never read: MONGODB_URI / JWT_SECRET /
 *    PAYMENT_WEBHOOK_SECRET are always overridden with fixture values in the
 *    child environments (dotenv cannot override an already-set process env).
 *  - Destructive scope: `seed --fresh` only ever deletes collections inside
 *    the runner-owned database (no dropDatabase of anything external).
 *
 * Flow: guard → memory server → seed --fresh → API server (PORT 5005).
 */
import { MongoMemoryServer } from 'mongodb-memory-server'
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertSafeTestDatabaseUrl } from './e2e-guard.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const serverDir = path.join(root, 'server')

/* ------------------------- fail-closed gate (FIRST) ------------------------- */
if (process.env.TEST_DATABASE_URL) {
  console.error('[e2e-start] REFUSING TO RUN: TEST_DATABASE_URL must not be set.')
  console.error('[e2e-start] This runner creates and owns a disposable in-memory database;')
  console.error('[e2e-start] external database URLs are never accepted for destructive seed operations.')
  process.exit(1)
}

/* ------------------------------ fixture env ------------------------------ */
const FIXTURE_SEED_PASSWORD = 'E2eFixture!2026'
const baseEnv = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: '5005',
  CLIENT_URL: 'http://127.0.0.1:3108',
  RATE_LIMIT_MAX: '5000',
  AUTH_RATE_LIMIT_MAX: '500',
  // Fixture-only secrets (this file is committed on purpose; production values
  // are never read or written here):
  JWT_SECRET: 'e2e-fixture-jwt-secret-not-production',
  PAYMENT_WEBHOOK_SECRET: 'e2e-fixture-webhook-secret-not-production',
  SEED_ADMIN_PASSWORD: FIXTURE_SEED_PASSWORD,
  SEED_CUSTOMER_PASSWORD: FIXTURE_SEED_PASSWORD,
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

/* --------------------- owned, disposable in-memory DB --------------------- */
// storageEngine: wiredTiger — the DEFAULT ephemeralForTest engine is known to
// wedge mid-run on this Windows host (mongod stops servicing established AND
// new connections while staying alive; observed during Gate W2.2). The
// file-backed engine is still fully disposable (stopped + removed on cleanup).
const memory = await MongoMemoryServer.create({
  instance: { storageEngine: 'wiredTiger' },
})
const uri = memory.getUri('store3d_e2e')
assertSafeTestDatabaseUrl(uri) // defense in depth: the owned URI must pass our own guard
console.log(`[e2e-start] disposable in-memory database owned by runner: ${uri}`)

async function cleanup(exitCode) {
  try {
    await memory.stop()
  } catch {
    /* best effort */
  }
  process.exit(exitCode)
}

/* --------------------------- destructive seed ---------------------------- */
// NOTE (Gate W2.2): the seed runs via async spawn with PIPED stdio, not
// spawnSync+inherit — spawnSync under Playwright's piped webServer capture
// never returned after a SUCCESSFUL (natural-exit) seed on this Windows host,
// while the async+pipe path exits cleanly (verified: exit code 0 in ~3.5s).
function runToCompletion(cmd, args, { cwd, env, timeoutMs = 120_000 }) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    })
    let output = ''
    const relay = (chunk) => {
      const text = chunk.toString()
      output += text
      process.stdout.write(text)
    }
    child.stdout.on('data', relay)
    child.stderr.on('data', relay)
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      console.error(`[e2e-start] seed did not exit within ${timeoutMs}ms — tree-killing it.`)
      spawnSync('taskkill', ['/F', '/T', '/PID', String(child.pid)], { stdio: 'ignore' })
    }, timeoutMs)
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, timedOut, output })
    })
  })
}

console.log('[e2e-start] seeding runner-owned database (seed --fresh)...')
const seed = await runToCompletion(npx, ['tsx', 'src/services/seed.ts', '--fresh'], {
  cwd: serverDir,
  env: { ...baseEnv, MONGODB_URI: uri },
})
if (seed.timedOut || seed.code !== 0) {
  console.error(`[e2e-start] seed failed (exit code ${seed.code}); aborting.`)
  await cleanup(seed.code ?? 1)
}

/* ------------------------------ API server ------------------------------- */
console.log('[e2e-start] starting API server against runner-owned database...')
const api = spawn(npx, ['tsx', 'src/server.ts'], {
  cwd: serverDir,
  env: { ...baseEnv, MONGODB_URI: uri },
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    api.kill(signal)
  })
}

api.on('exit', (code) => {
  console.log(`[e2e-start] API server exited (${code}); stopping disposable database.`)
  void cleanup(code ?? 0)
})
