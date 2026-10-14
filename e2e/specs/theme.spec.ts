import { test, expect } from '@playwright/test'
import { ANONYMOUS_BROWSE, watchPage } from '../helpers'

/** Dark/light theme smoke (read-only): class flip + persistence across reload. */
test.describe('Theme switching (read-only smoke)', () => {
  test('toggles .dark on <html>, persists the mode and survives a reload', async ({ page }) => {
    const watch = watchPage(page, ANONYMOUS_BROWSE)
    const html = page.locator('html')
    const toggle = () => page.getByRole('button', { name: 'Đổi giao diện' })

    await page.goto('/')
    // headless Chromium default preference is light → app starts without .dark
    await expect(html).not.toHaveClass(/\bdark\b/)

    await toggle().click()
    await expect(html).toHaveClass(/\bdark\b/)
    expect(await page.evaluate(() => localStorage.getItem('store3d-theme'))).toBe('dark')

    await page.reload()
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)

    await toggle().click()
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
    expect(await page.evaluate(() => localStorage.getItem('store3d-theme'))).toBe('light')

    expect(watch.failedResponses, watch.failedResponses.join('\n')).toEqual([])
    expect(watch.consoleErrors, watch.consoleErrors.join('\n')).toEqual([])
  })
})
