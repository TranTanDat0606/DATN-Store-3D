import { test, expect } from '@playwright/test'
import { ANONYMOUS_BROWSE, watchPage } from '../helpers'

const API = 'http://127.0.0.1:5005/api'

/**
 * Explicit API-routing + cookie/credential behavior verification (read-only).
 * The e2e client is served from a DIFFERENT origin (127.0.0.1:3108) than the
 * API (127.0.0.1:5005) on purpose — these tests prove the cross-origin
 * credentialed path works instead of assuming vite preview proxies like dev.
 */
test.describe('API routing & cookie behavior (read-only)', () => {
  test('API is reachable from the runner and healthy', async ({ page }) => {
    const res = await page.request.get(`${API}/health`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('ok')
    expect(body.data.db).toBe('connected')
  })

  test('cross-origin credentialed fetch from the app origin is CORS-allowed', async ({ page }) => {
    await page.goto('/')

    // JS on origin :3108 must be able to READ a credentialed response from :5005
    // (readable ⇒ server echoed Access-Control-Allow-Origin + Allow-Credentials).
    const result = await page.evaluate(async (api) => {
      const res = await fetch(`${api}/health`, { credentials: 'include' })
      return { status: res.status, body: await res.json() as { success: boolean } }
    }, API)

    expect(result.status).toBe(200)
    expect(result.body.success).toBe(true)
  })

  test('the app session probe (/auth/me) is CORS-clean: readable 401, no console errors', async ({ page }) => {
    const watch = watchPage(page, ANONYMOUS_BROWSE)

    const [meResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/me')),
      page.goto('/'),
    ])

    // A CORS or credentialed-XHR failure surfaces as requestfailed/status 0;
    // a READABLE 401 proves axios (withCredentials: true) works cross-origin.
    expect(meResponse.status()).toBe(401)
    expect(meResponse.ok()).toBe(false)
    expect(watch.consoleErrors, watch.consoleErrors.join('\n')).toEqual([])
  })
})
