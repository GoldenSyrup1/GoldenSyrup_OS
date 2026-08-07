import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from './App'

// The live hook fires fetches on mount; stub them so tests stay offline/deterministic.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline test'))),
  )
})

/** The nav drawer is closed by default and hidden via aria-hidden, so tests
 * that need to click a nav leaf must open it via the top nav toggle first. */
function openSidebar() {
  fireEvent.click(screen.getByRole('button', { name: /toggle navigation/i }))
}

describe('<App />', () => {
  it('renders the shell and the chat-centric dashboard sections', () => {
    render(<App />)
    // Appears in the top nav brand and the dashboard header.
    expect(screen.getAllByText(/GoldenSyrup OS/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Chat/i)).toBeInTheDocument()
    expect(screen.getByText(/8 Revolution Pillars/i)).toBeInTheDocument()
    expect(screen.getByText(/Milestones/i)).toBeInTheDocument()
    // Dropped from the main dashboard per the redesign — no longer rendered here.
    expect(screen.queryByText(/Project Dashboards/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Relationship Map/i)).not.toBeInTheDocument()
  })

  it('opens the nav drawer and switches views', () => {
    render(<App />)
    openSidebar()
    fireEvent.click(screen.getByRole('button', { name: /^Architectures$/i }))
    expect(screen.getByText(/\+ New Architecture/i)).toBeInTheDocument()

    openSidebar()
    fireEvent.click(screen.getByRole('button', { name: /^Cowork$/i }))
    // The Cowork composer is always present regardless of connection state.
    expect(screen.getByText(/Assign a task to Cowork/i)).toBeInTheDocument()
  })

  it('expands the Pillars branch and navigates to a pillar detail page', () => {
    render(<App />)
    openSidebar()
    fireEvent.click(screen.getByRole('button', { name: /^Pillars$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Finance$/i }))
    expect(screen.getByRole('heading', { name: 'Finance' })).toBeInTheDocument()
  })

  it('opens the statistics rail from the top nav', () => {
    render(<App />)
    // The rail is always in the DOM (a CSS-transformed drawer) so it's toggled
    // via aria-hidden rather than text presence/absence.
    const rail = screen.getByText(/Statistics \/ Tool Usage/i).closest('aside')
    expect(rail).toHaveAttribute('aria-hidden', 'true')
    fireEvent.click(screen.getByRole('button', { name: /toggle statistics/i }))
    expect(rail).toHaveAttribute('aria-hidden', 'false')
    expect(screen.getByText(/Session spend/i)).toBeInTheDocument()
  })

  it('lists tool-linked projects in the chat project selector', () => {
    render(<App />)
    const select = screen.getByLabelText(/project selection/i)
    expect(select).toBeInTheDocument()
    expect(screen.getAllByText(/WEPort/i).length).toBeGreaterThan(0)
  })
})
