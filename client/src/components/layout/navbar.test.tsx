import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { server } from '@/test/msw-server'
import { renderWithProviders, screen, within } from '@/test/test-utils'
import { CART_ITEM_FIXTURE, CART_STORAGE_KEY, CATEGORY_FIXTURES, THEME_STORAGE_KEY } from '@/test/fixtures'
import { Navbar } from '@/components/layout/navbar'

/**
 * Navbar — theme switching, cart badge (Gate W2.2) + shell navigation
 * (Gate B1). Theme assertions observe the two external, user-visible effects:
 * the `.dark` class on <html> and the persisted `store3d-theme` mode.
 */

const categoriesHandler = http.get('*/api/categories/all', () =>
  HttpResponse.json({ success: true, message: 'OK', data: CATEGORY_FIXTURES }),
)

beforeEach(() => {
  // The shell navigation fetches real categories (Gate B1 content contract).
  server.use(categoriesHandler)
})

describe('Navbar — theme switching', () => {
  it('toggles dark/light on documentElement and persists the mode', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Navbar />)

    const toggle = screen.getByRole('button', { name: 'Đổi giao diện' })

    // default mode is 'system'; the jsdom matchMedia stub reports light
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    await user.click(toggle)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    await user.click(toggle)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('has no detectable accessibility violations in light and dark themes', async () => {
    const user = userEvent.setup()
    const { container } = renderWithProviders(<Navbar />)

    expect(await axe(container)).toHaveNoViolations()

    await user.click(screen.getByRole('button', { name: 'Đổi giao diện' }))

    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('Navbar — cart badge', () => {
  it('mirrors the persisted cart total', () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([CART_ITEM_FIXTURE]))
    renderWithProviders(<Navbar />)

    const cartButton = screen.getByRole('button', { name: 'Giỏ hàng' })
    expect(within(cartButton).getByText(String(CART_ITEM_FIXTURE.quantity))).toBeInTheDocument()
  })

  it('renders no badge for an empty cart', () => {
    renderWithProviders(<Navbar />)

    const cartButton = screen.getByRole('button', { name: 'Giỏ hàng' })
    expect(within(cartButton).queryByText('1')).not.toBeInTheDocument()
  })
})

describe('Navbar — category navigation (Gate B1)', () => {
  it('opens the Danh mục menu and links each real category to the filtered listing', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Navbar />)

    await user.click(screen.getByRole('button', { name: /Danh mục/ }))

    const menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: 'Tất cả sản phẩm' })).toHaveAttribute(
      'href',
      '/san-pham',
    )
    for (const category of CATEGORY_FIXTURES) {
      expect(within(menu).getByRole('menuitem', { name: category.name })).toHaveAttribute(
        'href',
        `/san-pham?categorySlug=${category.slug}`,
      )
    }
  })

  it('lists the real categories and the login entry in the mobile menu', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Navbar />)

    await user.click(screen.getByRole('button', { name: 'Mở menu' }))

    const mobileNav = screen.getByRole('navigation', { name: 'Điều hướng di động' })
    for (const category of CATEGORY_FIXTURES) {
      expect(
        within(mobileNav).getByRole('link', { name: category.name }),
      ).toHaveAttribute('href', `/san-pham?categorySlug=${category.slug}`)
    }
    // anonymous login entry point lives inside the mobile menu at <sm widths
    const panel = document.getElementById('mobile-menu')!
    expect(within(panel).getByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument()
    // toggling again closes it
    await user.click(screen.getByRole('button', { name: 'Đóng menu' }))
    expect(document.getElementById('mobile-menu')).toBeNull()
  })

  it('ships no free-shipping claim in the shell header', () => {
    renderWithProviders(<Navbar />)
    expect(screen.queryByText(/miễn phí/i)).not.toBeInTheDocument()
  })

  it('has no accessibility violations with the mobile menu open', async () => {
    const user = userEvent.setup()
    const { container } = renderWithProviders(<Navbar />)

    await user.click(screen.getByRole('button', { name: 'Mở menu' }))

    expect(await axe(container)).toHaveNoViolations()
  })
})
