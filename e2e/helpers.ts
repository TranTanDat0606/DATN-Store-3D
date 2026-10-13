import { expect, type Page } from '@playwright/test'

/**
 * Shared E2E helpers (Gate W2.2). Ported from the NOVA reference patterns:
 * watchPage (console/network allowlist) + overflow guard.
 */

export interface PageWatch {
  consoleErrors: string[]
  failedResponses: string[]
}

export interface WatchOptions {
  /** Status codes that are expected and therefore allowed (e.g. 401 for the anonymous /auth/me probe). */
  allowStatus?: number[]
  /** URL patterns whose failed responses are expected (e.g. favicon). */
  allowUrlPatterns?: RegExp[]
  /**
   * Console-error patterns that are expected. Chromium itself logs every
   * non-2xx subresource response to the console ("Failed to load resource:
   * the server responded with a status of 401 (Unauthorized)"), so the
   * expected anonymous /auth/me 401 must be allowlisted HERE as well —
   * otherwise it is indistinguishable from a genuine console error.
   */
  allowConsolePatterns?: RegExp[]
}

/** Attach BEFORE navigation. Collects console errors and failed (>=400) responses. */
export function watchPage(page: Page, opts: WatchOptions = {}): PageWatch {
  const watch: PageWatch = { consoleErrors: [], failedResponses: [] }
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (opts.allowConsolePatterns?.some((re) => re.test(text))) return
    watch.consoleErrors.push(text)
  })
  page.on('response', (res) => {
    const status = res.status()
    if (status >= 400) {
      if (opts.allowStatus?.includes(status)) return
      if (opts.allowUrlPatterns?.some((re) => re.test(res.url()))) return
      watch.failedResponses.push(`${status} ${res.url()}`)
    }
  })
  return watch
}

/**
 * Anonymous browsing always triggers exactly one expected 401:
 * AuthProvider probes GET /auth/me on mount and the server guards it.
 */
export const ANONYMOUS_BROWSE: WatchOptions = {
  allowStatus: [401],
  allowUrlPatterns: [/favicon/],
  allowConsolePatterns: [
    /Failed to load resource: the server responded with a status of 401/,
  ],
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, 'horizontal overflow detected').toBeLessThanOrEqual(1)
}
