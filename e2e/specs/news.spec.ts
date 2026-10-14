import { test, expect } from '@playwright/test'
import { ANONYMOUS_BROWSE, expectNoHorizontalOverflow, watchPage } from '../helpers'

/** News listing + detail smoke (read-only, deterministic seed of 6 articles). */
test.describe('News (read-only smoke)', () => {
  test('news list renders and the first article opens its detail page', async ({ page }) => {
    const watch = watchPage(page, ANONYMOUS_BROWSE)

    await page.goto('/tin-tuc')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()

    const firstArticle = page.locator('a[href^="/tin-tuc/"]').first()
    await expect(firstArticle).toBeVisible()
    const href = await firstArticle.getAttribute('href')
    const slug = href?.split('/tin-tuc/')[1]
    expect(slug, 'article link must carry a slug').toBeTruthy()

    await firstArticle.click()

    await expect(page).toHaveURL(new RegExp(`/tin-tuc/${slug}$`))
    // detail renders article content inside main
    await expect(page.locator('main').first()).toBeVisible()
    await expect(page.getByText(/₫|in 3D|20\d{2}/).first()).toBeVisible()

    expect(watch.failedResponses, watch.failedResponses.join('\n')).toEqual([])
    expect(watch.consoleErrors, watch.consoleErrors.join('\n')).toEqual([])
    await expectNoHorizontalOverflow(page)
  })
})
