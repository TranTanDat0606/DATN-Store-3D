import { test, expect } from '@playwright/test'
import { ANONYMOUS_BROWSE, expectNoHorizontalOverflow, watchPage } from '../helpers'

/**
 * Homepage smoke (read-only). Seeded data is deterministic (12 products,
 * 6 categories), so headings + product links must render.
 */
test.describe('Homepage (read-only smoke)', () => {
  test('renders navigation, category section and product links without errors', async ({ page }) => {
    const watch = watchPage(page, ANONYMOUS_BROWSE)

    await page.goto('/')

    // core navigation (desktop viewport)
    const header = page.locator('header')
    await expect(header.getByRole('link', { name: 'Sản phẩm', exact: true })).toBeVisible()
    await expect(header.getByRole('link', { name: 'Tin tức' })).toBeVisible()
    await expect(header.getByRole('button', { name: 'Đổi giao diện' })).toBeVisible()
    await expect(header.getByRole('button', { name: 'Giỏ hàng' })).toBeVisible()

    // server-driven content sections from the deterministic seed
    await expect(page.getByRole('heading', { name: /danh mục sản phẩm/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /bán chạy/i })).toBeVisible()

    // at least one seeded product card links to a PDP
    await expect(page.locator('a[href^="/san-pham/"]').first()).toBeVisible()

    expect(watch.failedResponses, watch.failedResponses.join('\n')).toEqual([])
    expect(watch.consoleErrors, watch.consoleErrors.join('\n')).toEqual([])
    await expectNoHorizontalOverflow(page)
  })
})
