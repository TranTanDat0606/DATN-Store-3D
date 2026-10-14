import { test, expect } from '@playwright/test'
import { expectNoHorizontalOverflow } from '../helpers'

/** Responsive layout smoke: no horizontal overflow at 390 / 768 / 1280 widths. */
const VIEWPORTS = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 800 },
] as const

const ROUTES = ['/', '/san-pham', '/tin-tuc'] as const

for (const viewport of VIEWPORTS) {
  test.describe(`Responsive ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    for (const route of ROUTES) {
      test(`${route} has no horizontal overflow`, async ({ page }) => {
        // FINDING W2.2-4 (pre-existing app bug, NOT fixed in this gate):
        // at 390px the navbar's right-side action cluster (theme/cart/wishlist
        // buttons container, ~99px button + gap) extends to right=424 — a
        // 34px horizontal overflow present on EVERY route (probed: /,
        // /san-pham, /tin-tuc all overflow exactly 34px from the same
        // navbar element). Desktop (1280) and tablet (768) are clean.
        // test.fail() keeps the suite honest: the check RAN and correctly
        // detected the bug; when Gate B1 redesigns the shell/navbar this
        // annotation will flip to "passed unexpectedly" and must be removed.
        if (viewport.width === 390) test.fail()

        await page.goto(route)
        // wait for real content (footer is static, present on every route)
        await expect(page.locator('footer').first()).toBeVisible()
        await expectNoHorizontalOverflow(page)
      })
    }
  })
}
