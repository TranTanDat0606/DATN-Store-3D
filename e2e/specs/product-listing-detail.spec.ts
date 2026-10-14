import { test, expect } from '@playwright/test'
import { ANONYMOUS_BROWSE, expectNoHorizontalOverflow, watchPage } from '../helpers'

/** Product listing + PDP smoke (read-only). */
test.describe('Product listing & detail (read-only smoke)', () => {
  test('listing renders seeded products and the first one opens its PDP', async ({ page }) => {
    const watch = watchPage(page, ANONYMOUS_BROWSE)

    await page.goto('/san-pham')

    // shared ProductCard: a single anchor wraps image + h3 name + prices
    const firstNameLink = page.locator('a[href^="/san-pham/"]').first()
    await expect(firstNameLink).toBeVisible()
    const productName = (await firstNameLink.locator('h3').first().innerText()).trim()
    const slug = (await firstNameLink.getAttribute('href'))?.split('/san-pham/')[1]
    expect(slug, 'product link must carry a slug').toBeTruthy()

    await firstNameLink.click()

    await expect(page).toHaveURL(new RegExp(`/san-pham/${slug}$`))
    // the PDP renders the same product identity + a VND price
    await expect(page.getByText(productName).first()).toBeVisible()
    await expect(page.getByText(/₫/).first()).toBeVisible()

    expect(watch.failedResponses, watch.failedResponses.join('\n')).toEqual([])
    expect(watch.consoleErrors, watch.consoleErrors.join('\n')).toEqual([])
    await expectNoHorizontalOverflow(page)
  })
})
