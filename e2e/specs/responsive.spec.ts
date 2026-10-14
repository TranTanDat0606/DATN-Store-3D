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
        // Gate B1 fixed FINDING W2.2-4 (the navbar's right-side action cluster
        // overflowed 390px by 34px): the header was redesigned to fit. The
        // check is now STRICT at every viewport — no test.fail() annotation.
        await page.goto(route)
        // wait for real content (footer is static, present on every route)
        await expect(page.locator('footer').first()).toBeVisible()
        await expectNoHorizontalOverflow(page)
      })
    }
  })
}
