import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

/**
 * MSW server (Gate W2.2). Mocking happens at the HTTP boundary so the app's
 * real axios instance, response interceptor and serialization always run.
 * Zero-crossing rule: no module mocks of `services/apiClient`.
 *
 * Default handlers (restored by `resetHandlers()` after each test):
 * - GET /auth/me  → 401 (anonymous session). Every mounted app tree calls this
 *   on mount via AuthProvider; 401 matches the server's requireAuth guard.
 * - GET /wishlist → empty wishlist (WishlistProvider calls it once authed).
 */
export const authMeAnonymousHandler = http.get('*/api/auth/me', () =>
  HttpResponse.json(
    { success: false, message: 'Chưa đăng nhập', data: null },
    { status: 401 },
  ),
)

export const wishlistEmptyHandler = http.get('*/api/wishlist', () =>
  HttpResponse.json({ success: true, message: 'OK', data: { products: [] } }),
)

export const server = setupServer(authMeAnonymousHandler, wishlistEmptyHandler)
