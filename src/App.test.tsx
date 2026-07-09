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

describe('<App />', () => {
  it('renders the command-centre shell and all core sections', () => {
    render(<App />)
    // Appears in the sidebar brand and the dashboard header.
    expect(screen.getAllByText(/GoldenSyrup OS/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Command Console/i)).toBeInTheDocument()
    expect(screen.getByText(/Startups \/ Projects/i)).toBeInTheDocument()
    expect(screen.getByText(/8 Revolution Pillars/i)).toBeInTheDocument()
    expect(screen.getByText(/Project Dashboards/i)).toBeInTheDocument()
    expect(screen.getByText(/Relationship Map/i)).toBeInTheDocument()
    // "Job Search" appears twice: the section title and the Command Console tree leaf.
    expect(screen.getAllByText(/Job Search/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/ETH Trades/i)).toBeInTheDocument()
  })

  it('falls back to the seed layer and shows known projects + jobs', () => {
    render(<App />)
    expect(screen.getAllByText(/WEPort/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/GoldenSyrup_Intel/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Atlassian/i)).toBeInTheDocument()
  })

  it('switches views from the sidebar rail', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Architectures/i }))
    expect(screen.getByText(/\+ New Architecture/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Cowork/i }))
    // The Cowork composer is always present regardless of connection state.
    expect(screen.getByText(/Assign a task to Cowork/i)).toBeInTheDocument()
  })
})
