import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { server } from '@/test/msw-server'
import { renderWithProviders, screen, waitFor } from '@/test/test-utils'
import {
  CART_STORAGE_KEY,
  ORIGINAL_PRICE_TEXT,
  PRODUCT_IN_STOCK,
  PRODUCT_OUT_OF_STOCK,
  SALE_PRICE_TEXT,
  USER_FIXTURE,
  authMeAuthenticatedHandler,
} from '@/test/fixtures'
import { ProductCard } from '@/components/product/product-card'

/**
 * ProductCard (Gate W2.2 initial suite).
 * Seam: rendered UI + HTTP boundary only (MSW). No module mocks.
 */

describe('ProductCard', () => {
  it('renders product name, sale/original prices and links to the PDP', async () => {
    const { container } = renderWithProviders(<ProductCard product={PRODUCT_IN_STOCK} />)

    expect(
      screen.getByRole('heading', { level: 3, name: PRODUCT_IN_STOCK.name }),
    ).toBeInTheDocument()
    expect(screen.getByText(SALE_PRICE_TEXT)).toBeInTheDocument()
    expect(screen.getByText(ORIGINAL_PRICE_TEXT)).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      `/san-pham/${PRODUCT_IN_STOCK.slug}`,
    )

    expect(await axe(container)).toHaveNoViolations()
  })

  it('anonymous add-to-cart opens the login prompt and does NOT mutate the cart', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProductCard product={PRODUCT_IN_STOCK} />)

    await user.click(screen.getByRole('button', { name: /thêm vào giỏ/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng đăng nhập')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument()
    // CartContext persists its (still empty) state on mount — assert no ITEM was added.
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? '[]')).toHaveLength(0)
  })

  it('authenticated add-to-cart persists the item and never opens the login prompt', async () => {
    let meServed = false
    let wishlistServed = false
    server.use(
      http.get('*/api/auth/me', () => {
        meServed = true
        return HttpResponse.json(authMeAuthenticatedHandler())
      }),
      http.get('*/api/wishlist', () => {
        wishlistServed = true
        return HttpResponse.json({ success: true, message: 'OK', data: { products: [] } })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<ProductCard product={PRODUCT_IN_STOCK} />)

    // WishlistProvider only fires once AuthProvider committed isAuthenticated=true.
    await waitFor(() => expect(meServed).toBe(true))
    await waitFor(() => expect(wishlistServed).toBe(true))

    await user.click(screen.getByRole('button', { name: /thêm vào giỏ/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => {
      const stored: Array<{ productId: string; quantity: number }> = JSON.parse(
        localStorage.getItem(CART_STORAGE_KEY) ?? '[]',
      )
      expect(stored).toHaveLength(1)
      expect(stored[0]).toMatchObject({ productId: PRODUCT_IN_STOCK._id, quantity: 1 })
    })
  })

  it('disables add-to-cart for out-of-stock products and shows the Hết hàng state', () => {
    renderWithProviders(<ProductCard product={PRODUCT_OUT_OF_STOCK} />)

    const button = screen.getByRole('button', { name: /hết hàng/i })
    expect(button).toBeDisabled()
  })

  it('anonymous wishlist click does not open the login dialog (current toast-only behavior)', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProductCard product={PRODUCT_IN_STOCK} />)

    await user.click(screen.getByRole('button', { name: 'Thêm vào yêu thích' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? '[]')).toHaveLength(0)
  })

  it('has no detectable accessibility violations (login prompt open state)', async () => {
    const user = userEvent.setup()
    const { container } = renderWithProviders(<ProductCard product={PRODUCT_IN_STOCK} />)

    await user.click(screen.getByRole('button', { name: /thêm vào giỏ/i }))
    await screen.findByRole('dialog')

    expect(await axe(container)).toHaveNoViolations()
    expect(USER_FIXTURE._id).toBe('user-1') // fixture integrity (independent literal)
  })
})
