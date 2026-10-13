import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { renderWithProviders, screen, within } from '@/test/test-utils'
import { CART_ITEM_FIXTURE, CART_STORAGE_KEY, THEME_STORAGE_KEY } from '@/test/fixtures'
import { Navbar } from '@/components/layout/navbar'

/**
 * Navbar — theme switching + cart badge (Gate W2.2 initial suite).
 * Theme assertions observe the two external, user-visible effects:
 * the `.dark` class on <html> and the persisted `store3d-theme` mode.
 */

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
