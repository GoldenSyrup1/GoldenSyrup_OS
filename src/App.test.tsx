import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('<App />', () => {
  it('renders the command-centre shell and core sections', () => {
    render(<App />)
    expect(screen.getByText(/GoldenSyrup OS/i)).toBeInTheDocument()
    expect(screen.getByText(/8 Revolution Pillars/i)).toBeInTheDocument()
    expect(screen.getByText(/Project Dashboards/i)).toBeInTheDocument()
    expect(screen.getByText(/Relationship Map/i)).toBeInTheDocument()
  })

  it('shows known seeded projects', () => {
    render(<App />)
    expect(screen.getAllByText(/WEPort/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/GoldenSyrup_Intel/i).length).toBeGreaterThan(0)
  })
})
