import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { server } from '@/test/msw-server'
import { renderWithProviders, screen, waitFor } from '@/test/test-utils'
import {
  CATEGORY_FIXTURES,
  PRODUCT_IN_STOCK,
  SECOND_CATEGORY_PRODUCT,
} from '@/test/fixtures'
import ProductListPage from '@/pages/product-list-page'
import type { Product } from '@/types'

/**
 * ProductListPage — category navigation (Gate W2.2 initial suite).
 * Seam: URL params in → HTTP requests out. Assertions observe the network
 * requests the page actually made (behavior), not CSS classes (structure).
 */

const categoriesHandler = http.get('*/api/categories/all', () =>
  HttpResponse.json({ success: true, message: 'OK', data: CATEGORY_FIXTURES }),
)

function productsHandler(capture: (url: URL) => void, products: Product[]) {
  return http.get('*/api/products', ({ request }) => {
    capture(new URL(request.url))
    return HttpResponse.json({
      success: true,
      message: 'OK',
      data: products,
      pagination: { page: 1, limit: 12, total: products.length, totalPages: 1 },
    })
  })
}

describe('ProductListPage — category navigation', () => {
  it('renders the category filter and the product grid from the API', async () => {
    const calls: URL[] = []
    server.use(categoriesHandler, productsHandler((u) => calls.push(u), [SECOND_CATEGORY_PRODUCT]))

    const { container } = renderWithProviders(<ProductListPage />, {
      initialEntries: ['/san-pham'],
    })

    expect(screen.getByRole('heading', { name: 'Danh mục' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Tất cả' })).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: CATEGORY_FIXTURES[1].name }),
    ).toBeInTheDocument()
    expect(await screen.findByText(SECOND_CATEGORY_PRODUCT.name)).toBeInTheDocument()
    await waitFor(() => expect(calls.length).toBeGreaterThan(0))

    // FINDINGS W2.2-2/3 (existing app markup, NOT fixed in this gate — the
    // listing page is slated for redesign in Gate B3):
    //  W2.2-2 button-name: the sort-by Radix Select trigger (role=combobox)
    //        has no accessible name (no aria-label / labelled <span>).
    //  W2.2-3 heading-order: the first heading in the page is an h3 ("Danh
    //        mục") — the document starts below heading level 1.
    // Rules disabled FOR THIS TEST ONLY; all other axe rules still run.
    expect(
      await axe(container, {
        rules: {
          'button-name': { enabled: false },
          'heading-order': { enabled: false },
        },
      }),
    ).toHaveNoViolations()
  })

  it('requests products filtered by the category slug present in the URL', async () => {
    const calls: URL[] = []
    server.use(categoriesHandler, productsHandler((u) => calls.push(u), [SECOND_CATEGORY_PRODUCT]))

    renderWithProviders(<ProductListPage />, {
      initialEntries: ['/san-pham?categorySlug=mo-hinh-xe-tang'],
    })

    await waitFor(() =>
      expect(calls.some((u) => u.searchParams.get('categorySlug') === 'mo-hinh-xe-tang')).toBe(true),
    )
    expect(await screen.findByText(SECOND_CATEGORY_PRODUCT.name)).toBeInTheDocument()
  })

  it('clicking a category button refetches products for that category', async () => {
    const calls: URL[] = []
    server.use(
      categoriesHandler,
      productsHandler((u) => calls.push(u), [PRODUCT_IN_STOCK, SECOND_CATEGORY_PRODUCT]),
    )
    const user = userEvent.setup()

    renderWithProviders(<ProductListPage />, { initialEntries: ['/san-pham'] })
    await screen.findByText(PRODUCT_IN_STOCK.name)

    await user.click(screen.getByRole('button', { name: CATEGORY_FIXTURES[1].name }))

    await waitFor(() =>
      expect(calls.at(-1)?.searchParams.get('categorySlug')).toBe(CATEGORY_FIXTURES[1].slug),
    )
    expect(await screen.findByText(SECOND_CATEGORY_PRODUCT.name)).toBeInTheDocument()
  })

  it('renders the empty state when no product matches', async () => {
    server.use(categoriesHandler, productsHandler(() => {}, []))

    renderWithProviders(<ProductListPage />, {
      initialEntries: ['/san-pham?categorySlug=khong-ton-tai'],
    })

    expect(await screen.findByText('Không tìm thấy sản phẩm')).toBeInTheDocument()
  })
})
