/**
 * Test-database guard (Gate W2.2 — Phase 3, fail-closed).
 *
 * Validates any externally supplied TEST_DATABASE_URL BEFORE it could ever be
 * used for a destructive operation (seed --fresh). Rules enforced:
 *   1. the variable must be present and non-empty
 *   2. it must parse as a MongoDB connection URL
 *   3. the host must be loopback (127.0.0.1 / localhost / ::1) — remote hosts rejected
 *   4. the database name must end with `_e2e` or `_test`
 *   5. it must not equal the production MONGODB_URI (when that is known)
 * Any violation throws — callers must treat a throw as a hard stop.
 */

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])
const SAFE_DB_SUFFIX = /(_e2e|_test)$/

export function assertSafeTestDatabaseUrl(url, { productionUri } = {}) {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    throw new Error('TEST_DATABASE_URL is required but was absent or empty (fail closed).')
  }

  let parsed
  try {
    parsed = new URL(url.trim())
  } catch {
    throw new Error(`TEST_DATABASE_URL is not a valid URL: ${url} (fail closed).`)
  }

  if (!/^mongodb(\+srv)?:$/.test(parsed.protocol)) {
    throw new Error(`TEST_DATABASE_URL protocol must be mongodb/mongodb+srv, got "${parsed.protocol}" (fail closed).`)
  }

  if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `TEST_DATABASE_URL host must be loopback, got "${parsed.hostname}" — external/production hosts are rejected (fail closed).`,
    )
  }

  const dbName = parsed.pathname.replace(/^\//, '')
  if (!SAFE_DB_SUFFIX.test(dbName)) {
    throw new Error(
      `TEST_DATABASE_URL database name must end with "_e2e" or "_test", got "${dbName || '(none)'}" (fail closed).`,
    )
  }

  if (productionUri && url.trim() === String(productionUri).trim()) {
    throw new Error('TEST_DATABASE_URL is identical to the production MONGODB_URI — refusing (fail closed).')
  }

  return url.trim()
}

/* CLI: `node scripts/e2e-guard.mjs` → exit 0 when safe, exit 1 (fail closed) otherwise. */
const invokedDirectly = process.argv[1] && import.meta.url.endsWith(pathBasename(process.argv[1]))
function pathBasename(p) {
  return p.split(/[\\/]/).pop()
}

if (invokedDirectly) {
  try {
    assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL, {
      productionUri: process.env.MONGODB_URI_PRODUCTION_CHECK,
    })
    console.log('[e2e-guard] TEST_DATABASE_URL is safe for test use.')
    process.exit(0)
  } catch (err) {
    console.error(`[e2e-guard] ${err.message}`)
    process.exit(1)
  }
}
