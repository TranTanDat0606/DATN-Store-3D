import { http, HttpResponse } from 'msw'
import { axe } from 'vitest-axe'
import { server } from '@/test/msw-server'
import { renderWithProviders, screen } from '@/test/test-utils'
import { CATEGORY_FIXTURES, THEME_STORAGE_KEY } from '@/test/fixtures'
import { Footer } from '@/components/layout/footer'

/**
 * Footer — truthful shell content (Gate B1 approved content contract):
 * real categories only, existing routes only, no invented contact data,
 * no social links, no free-shipping claims.
 */

const categoriesHandler = http.get('*/api/categories/all', () =>
  HttpResponse.json({ success: true, message: 'OK', data: CATEGORY_FIXTURES }),
)

beforeEach(() => {
  server.use(categoriesHandler)
})

describe('Footer — links (Gate B1)', () => {
  it('links every real category to the filtered listing', async () => {
    renderWithProviders(<Footer />)
    for (const category of CATEGORY_FIXTURES) {
      expect(await screen.findByRole('link', { name: category.name })).toHaveAttribute(
        'href',
        `/san-pham?categorySlug=${category.slug}`,
      )
    }
  })

  it('links only routes that exist in the router (no dead or external links)', async () => {
    renderWithProviders(<Footer />)
    // wait for the async category column so the full link set is asserted
    await screen.findByRole('link', { name: CATEGORY_FIXTURES[0].name })

    const allowedPaths = new Set(['/', '/san-pham', '/tin-tuc', '/lien-he', '/tai-khoan'])
    for (const link of screen.getAllByRole('link')) {
      const href = link.getAttribute('href') ?? ''
      expect(href.startsWith('/'), `external link is not allowed: ${href}`).toBe(true)
      const isCategoryLink = href.startsWith('/san-pham?categorySlug=')
      const path = href.split('?')[0]
      expect(
        isCategoryLink || allowedPaths.has(path),
        `link outside the approved route set: ${href}`,
      ).toBe(true)
    }
  })
})

describe('Footer — truthful content (Gate B1)', () => {
  it('ships no invented contact data, social links or free-shipping claims', () => {
    renderWithProviders(<Footer />)

    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/miễn phí/i)
    expect(text).not.toMatch(/0\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3}/) // phone numbers
    expect(text).not.toMatch(/[\w.-]+@[\w.-]+/) // e-mail addresses
    expect(screen.queryByText(/Nguyễn Trãi/)).toBeNull()

    // no tel:, mailto: or unverifiable external (social) links
    expect(document.querySelector('a[href^="tel:"]')).toBeNull()
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull()
    expect(document.querySelector('a[href^="http"]')).toBeNull()
  })

  it('copyright carries the current year', () => {
    renderWithProviders(<Footer />)
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()}`))).toBeInTheDocument()
  })
})

describe('Footer — accessibility (Gate B1)', () => {
  it('has no accessibility violations in light and dark themes', async () => {
    const { container, unmount } = renderWithProviders(<Footer />)
    await screen.findByRole('link', { name: CATEGORY_FIXTURES[0].name })

    expect(await axe(container)).toHaveNoViolations()

    // unmount first: two <footer> landmarks in one document would itself be
    // a landmark-no-duplicate-contentinfo violation
    unmount()
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    const { container: darkContainer } = renderWithProviders(<Footer />)
    await screen.findByRole('link', { name: CATEGORY_FIXTURES[0].name })

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(await axe(darkContainer)).toHaveNoViolations()
  })
})
