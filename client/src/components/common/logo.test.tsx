import { renderWithProviders, screen } from '@/test/test-utils'
import { Logo, LogoMark } from './logo'

/**
 * L.01 logo lockups (Gate B1): the mark is decorative (aria-hidden) and the
 * accessible name comes from the "STORE 3D" wordmark text.
 */

describe('Logo (Gate B1)', () => {
  it('renders the mark as decorative SVG', () => {
    const { container } = renderWithProviders(<LogoMark />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders the STORE 3D wordmark text', () => {
    renderWithProviders(<Logo />)
    // the wordmark is two text segments ("STORE " + "3D"); RTL matches each
    expect(screen.getByText('STORE')).toBeInTheDocument()
    expect(screen.getByText('3D')).toBeInTheDocument()
  })

  it('renders mark-only without the wordmark when asked', () => {
    const { container } = renderWithProviders(<Logo withWordmark={false} />)
    expect(screen.queryByText('STORE ')).not.toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
