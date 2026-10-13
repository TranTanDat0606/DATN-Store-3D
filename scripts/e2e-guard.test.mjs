/**
 * Guard negative tests (Gate W2.2 — Phase 3, "safe negative tests").
 * These demonstrate fail-closed behavior WITHOUT contacting any database:
 * every case is pure URL validation, plus one runner-refusal check that
 * provably exits before any MongoDB process is created.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertSafeTestDatabaseUrl } from './e2e-guard.mjs'

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))

test('rejects a missing/empty URL (fail closed)', () => {
  assert.throws(() => assertSafeTestDatabaseUrl(undefined), /required/)
  assert.throws(() => assertSafeTestDatabaseUrl(''), /required/)
  assert.throws(() => assertSafeTestDatabaseUrl('   '), /required/)
})

test('rejects an unparseable URL', () => {
  assert.throws(() => assertSafeTestDatabaseUrl('not a url at all'), /not a valid URL/)
})

test('rejects a non-mongodb protocol', () => {
  assert.throws(() => assertSafeTestDatabaseUrl('https://127.0.0.1/store3d_e2e'), /protocol/)
})

test('rejects external/production hosts (Atlas, LAN, etc.)', () => {
  assert.throws(
    () => assertSafeTestDatabaseUrl('mongodb+srv://cluster0.x.mongodb.net/store3d_e2e'),
    /loopback/,
  )
  assert.throws(
    () => assertSafeTestDatabaseUrl('mongodb://10.0.0.5:27017/store3d_e2e'),
    /loopback/,
  )
})

test('rejects unsafe database names (no _e2e/_test suffix)', () => {
  assert.throws(() => assertSafeTestDatabaseUrl('mongodb://127.0.0.1:27017/store3d'), /_e2e|_test/)
  assert.throws(() => assertSafeTestDatabaseUrl('mongodb://127.0.0.1:27017/store3d_test2'), /_e2e|_test/)
  assert.throws(() => assertSafeTestDatabaseUrl('mongodb://127.0.0.1:27017/'), /_e2e|_test/)
})

test('rejects a URL identical to the production MONGODB_URI', () => {
  const prod = 'mongodb://127.0.0.1:27017/store3d_e2e' // even a "safe-looking" name
  assert.throws(
    () => assertSafeTestDatabaseUrl(prod, { productionUri: prod }),
    /identical to the production/,
  )
})

test('accepts a loopback URL with a safe database name', () => {
  const ok = 'mongodb://127.0.0.1:27017/store3d_e2e'
  assert.equal(assertSafeTestDatabaseUrl(ok), ok)
})

test('e2e-start REFUSES to run when TEST_DATABASE_URL is set (before any DB work)', () => {
  const res = spawnSync(process.execPath, [path.join(scriptsDir, 'e2e-start.mjs')], {
    env: { ...process.env, TEST_DATABASE_URL: 'mongodb://127.0.0.1:27017/store3d_e2e' },
    encoding: 'utf8',
    timeout: 30_000,
  })
  assert.equal(res.status, 1, 'runner must exit non-zero')
  assert.match(res.stderr, /REFUSING TO RUN/)
  // The refusal happens BEFORE MongoMemoryServer.create(), so no mongod binary
  // is downloaded or started — that is what makes this a *safe* negative test.
  assert.doesNotMatch(res.stdout ?? '', /MongoMemoryServer/i)
})
