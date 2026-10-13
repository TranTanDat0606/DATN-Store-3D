import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { CartProvider } from '@/contexts/CartContext'
import { WishlistProvider } from '@/contexts/WishlistContext'

/**
 * Test-utils (Gate W2.2). Mirrors the REAL provider chain exactly:
 * main.tsx wraps BrowserRouter in ThemeProvider; App.tsx nests
 * AuthProvider → CartProvider → WishlistProvider inside the router.
 * No synthetic providers, no module mocks — the real tree ships.
 */

function makeWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <AuthProvider>
            <CartProvider>
              <WishlistProvider>{children}</WishlistProvider>
            </CartProvider>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    )
  }
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[]
}

export function renderWithProviders(
  ui: ReactElement,
  { initialEntries = ['/'], ...options }: RenderWithProvidersOptions = {},
) {
  return render(ui, { wrapper: makeWrapper(initialEntries), ...options })
}

export * from '@testing-library/react'
