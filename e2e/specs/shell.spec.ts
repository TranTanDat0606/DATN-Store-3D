import { test, expect } from '@playwright/test'
import { ANONYMOUS_BROWSE, expectNoHorizontalOverflow, watchPage } from '../helpers'

const API = 'http://127.0.0.1:5005/api'

/**
 * Shell smoke (Gate B1, read-only): the redesigned header/footer navigation.
 * Category data is read from the seeded API (data-driven, no hardcoded names).
 */

test.describe('Shell — desktop header category navigation', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('Danh mục menu lists the seeded categories and filters the listing', async ({ page }) => {
    const watch = watchPage(page, ANONYMOUS_BROWSE)

    const catsRes = await page.request.get(`${API}/categories/all`)
    expect(catsRes.ok()).toBe(true)
    const { data: categories } = await catsRes.json()
    expect(categories.length).toBeGreaterThan(0)

    await page.goto('/')
    await expect(page.locator('header').first()).toBeVisible()

    await page.getByRole('button', { name: 'Danh mục' }).click()
    const menu = page.getByRole('menu')
    await expect(menu.getByRole('menuitem', { name: 'Tất cả sản phẩm' })).toBeVisible()
    for (const category of categories) {
      await expect(menu.getByRole('menuitem', { name: category.name })).toBeVisible()
    }

    const [productsResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/products') && r.url().includes('categorySlug='),
      ),
      menu.getByRole('menuitem', { name: categories[0].name }).click(),
    ])
    expect(productsResponse.ok()).toBe(true)
    await expect(page).toHaveURL(new RegExp(`categorySlug=${categories[0].slug}`))
    await expectNoHorizontalOverflow(page)

    expect(watch.failedResponses, watch.failedResponses.join('\n')).toEqual([])
    expect(watch.consoleErrors, watch.consoleErrors.join('\n')).toEqual([])
  })
})

test.describe('Shell — mobile menu at 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('mobile menu exposes categories and the login entry; header fits 390px', async ({ page }) => {
    const watch = watchPage(page, ANONYMOUS_BROWSE)

    const catsRes = await page.request.get(`${API}/categories/all`)
    expect(catsRes.ok()).toBe(true)
    const { data: categories } = await catsRes.json()

    await page.goto('/')
    await expect(page.locator('header').first()).toBeVisible()

    await page.getByRole('button', { name: 'Mở menu' }).click()
    const mobileNav = page.getByRole('navigation', { name: 'Điều hướng di động' })
    await expect(mobileNav.getByRole('link', { name: 'Trang chủ' })).toBeVisible()
    for (const category of categories) {
      await expect(mobileNav.getByRole('link', { name: category.name })).toBeVisible()
    }
    // anonymous login entry point lives inside the mobile menu (<sm header
    // hides the text button so the action cluster fits 390px — W2.2-4 fix)
    await expect(page.locator('#mobile-menu').getByRole('button', { name: 'Đăng nhập' })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    // closing the menu must leave an overflow-free header on its own
    await page.getByRole('button', { name: 'Đóng menu' }).click()
    await expect(page.locator('#mobile-menu')).toBeHidden()
    await expectNoHorizontalOverflow(page)

    expect(watch.failedResponses, watch.failedResponses.join('\n')).toEqual([])
    expect(watch.consoleErrors, watch.consoleErrors.join('\n')).toEqual([])
  })
})
