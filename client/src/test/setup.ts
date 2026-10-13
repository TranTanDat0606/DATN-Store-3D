import '@testing-library/jest-dom/vitest'
// vitest-axe 0.1.0 ships an EMPTY dist/extend-expect.js (packaging bug), so the
// matcher must be registered explicitly; the /extend-expect import stays for
// its type augmentation only.
import 'vitest-axe/extend-expect'
import * as axeMatchers from 'vitest-axe/matchers'
import { expect } from 'vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './msw-server'

expect.extend(axeMatchers)

/**
 * Component-test environment (Gate W2.2).
 * - jsdom (NEVER happy-dom: its isConnected bug breaks axe-core traversal).
 * - MSW lifecycle: fail loudly on un-mocked requests, EXCEPT the runner's own
 *   loopback (127.0.0.1) which future API-layer tests may hit for real.
 */

beforeAll(() => {
  server.listen({
    onUnhandledRequest({ url }) {
      // Bypass only local loopback traffic; everything else must be mocked.
      return url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost:127.0.0.1')
        ? 'bypass'
        : 'error'
    },
  })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  // Deterministic per-test state: no persistence bleed between tests.
  localStorage.clear()
  document.documentElement.className = ''
  document.body.className = ''
})

afterAll(() => {
  server.close()
})

/* ---------- jsdom polyfills for browser APIs the app touches ---------- */

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false, // default: light preference ("system" theme resolves to light)
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  ;(globalThis as Record<string, unknown>).ResizeObserver = ResizeObserverStub
}

if (!('IntersectionObserver' in globalThis)) {
  // framer-motion `whileInView` degrades to initial state; elements stay in the
  // DOM (assertions still work), the callback simply never fires.
  class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
    root = null
    rootMargin = ''
    thresholds: number[] = []
  }
  ;(globalThis as Record<string, unknown>).IntersectionObserver = IntersectionObserverStub
}

if (!window.scrollTo) {
  window.scrollTo = (() => {}) as unknown as typeof window.scrollTo
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
