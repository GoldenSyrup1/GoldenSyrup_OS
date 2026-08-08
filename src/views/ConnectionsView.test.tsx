import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConnectionsView from './ConnectionsView'
import { contacts } from '../data/seed'
import type { Project } from '../types'

describe('<ConnectionsView />', () => {
  it('renders the seeded contacts and the relationship map', () => {
    const projects: Project[] = [
      { id: 'weport', name: 'WEPort', status: 'live', progress: 95, summary: '', nextAction: '' },
    ]
    render(<ConnectionsView projects={projects} />)

    expect(screen.getByRole('heading', { name: /relationship map/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^contacts$/i })).toBeInTheDocument()
    for (const c of contacts) {
      expect(screen.getAllByText(c.name).length).toBeGreaterThan(0)
    }
  })
})
