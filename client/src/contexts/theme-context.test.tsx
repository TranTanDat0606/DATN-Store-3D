import { act } from '@testing-library/react'
import { renderWithProviders } from '@/test/test-utils'
import { THEME_STORAGE_KEY } from '@/test/fixtures'

/**
 * ThemeContext — system-preference verification (Gate B1 required
 * verification: "verify theme persistence and system preference").
 * Persistence itself is covered by navbar.test.tsx; this file exercises the
 * `system` mode against a controllable matchMedia (initial OS preference
 * + live OS change), which the fixed jsdom stub in setup.ts cannot.
 * renderWithProviders already mounts the real ThemeProvider.
 */

type ChangeHandler = () => void

let systemIsDark = false
let changeHandler: ChangeHandler | null = null

beforeAll(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-color-scheme: dark') ? systemIsDark : false,
    media: query,
    onchange: null,
    addEventListener: (_event: string, handler: ChangeHandler) => {
      changeHandler = handler
    },
    removeEventListener: () => {
      changeHandler = null
    },
    dispatchEvent: () => false,
  }))
})

afterAll(() => {
  vi.unstubAllGlobals()
  systemIsDark = false
  changeHandler = null
})

function Probe() {
  return <div data-testid="probe" />
}

describe('ThemeContext — system preference (Gate B1)', () => {
  it('applies a dark OS preference on boot (default mode is system)', () => {
    systemIsDark = true
    renderWithProviders(<Probe />)

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system')
  })

  it('applies a light OS preference on boot', () => {
    systemIsDark = false
    renderWithProviders(<Probe />)

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system')
  })

  it('an explicit stored mode wins over the OS preference', () => {
    systemIsDark = true
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    renderWithProviders(<Probe />)

    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('follows a live OS preference change while in system mode', () => {
    systemIsDark = false
    renderWithProviders(<Probe />)
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    systemIsDark = true
    act(() => changeHandler?.())

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})

