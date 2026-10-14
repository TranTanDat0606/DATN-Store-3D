import { test, expect } from '@playwright/test'
import { ANONYMOUS_BROWSE, expectNoHorizontalOverflow, watchPage } from '../helpers'

const API = 'http://127.0.0.1:5005/api'

/**
 * Category navigation smoke (read-only). Category data is read from the API
 * (deterministic seed) so the spec stays data-driven instead of hardcoding
 * Vietnamese seed names.
 */
test.describe('Category navigation (read-only smoke)', () => {
  test('clicking a category on /san-pham filters the listing through the URL', async ({ page }) => {
    const watch = watchPage(page, ANONYMOUS_BROWSE)

    const catsRes = await page.request.get(`${API}/categories/all`)
    expect(catsRes.ok()).toBe(true)
    const { data: categories } = await catsRes.json()
    expect(categories.length).toBeGreaterThan(0)
    const category = categories[0]

    await page.goto('/san-pham')
    await expect(page.getByRole('heading', { name: 'Danh mục' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tất cả' })).toBeVisible()

    const [productsResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/products') && r.url().includes(`categorySlug=${category.slug}`),
      ),
      page.getByRole('button', { name: category.name, exact: true }).click(),
    ])

    expect(productsResponse.ok()).toBe(true)
    await expect(page).toHaveURL(new RegExp(`categorySlug=${category.slug}`))
    // product grid renders whatever the filtered API returned
    // (the shared ProductCard: one anchor wrapping the h3 name)
    const body = await productsResponse.json()
    if (body.data.length > 0) {
      await expect(page.locator('a[href^="/san-pham/"] h3').first()).toBeVisible()
    } else {
      await expect(page.getByText('Không tìm thấy sản phẩm')).toBeVisible()
    }

    expect(watch.failedResponses, watch.failedResponses.join('\n')).toEqual([])
    expect(watch.consoleErrors, watch.consoleErrors.join('\n')).toEqual([])
    await expectNoHorizontalOverflow(page)
  })
})
