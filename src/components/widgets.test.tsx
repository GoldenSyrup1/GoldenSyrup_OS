import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RadarChart from './RadarChart'
import ContactPanel from './ContactPanel'
import type { Pillar, Contact, Project } from '../types'

const pillars: Pillar[] = [
  { id: 'gov', name: 'Government', status: 'live', progress: 60, nextAction: 'x' },
  { id: 'fin', name: 'Finance', status: 'progress', progress: 35, nextAction: 'y' },
  { id: 'law', name: 'Law', status: 'idle', progress: 5, nextAction: 'z' },
]

describe('RadarChart', () => {
  it('renders an accessible svg with a label per pillar', () => {
    render(<RadarChart pillars={pillars} />)
    expect(screen.getByRole('img', { name: /radar/i })).toBeInTheDocument()
    expect(screen.getByText('Government')).toBeInTheDocument()
    expect(screen.getByText('Finance')).toBeInTheDocument()
  })
})

describe('ContactPanel', () => {
  const projects: Project[] = [
    { id: 'weport', name: 'WEPort', status: 'live', progress: 95, summary: '', nextAction: '' },
  ]
  const contacts: Contact[] = [
    {
      id: 'peter',
      name: 'Peter Ratcliffe',
      role: 'Connector',
      relationship: 'mentor',
      followUp: 'supports post-launch',
      connectsTo: ['weport'],
    },
    {
      id: 'gavin',
      name: 'Gavin Schwarz',
      role: 'Contact',
      relationship: 'connector',
      connectsTo: [],
      linkedIn: 'https://www.linkedin.com/in/example-gavin',
    },
  ]

  it('opens a detail drawer on click and resolves connected project names', () => {
    render(<ContactPanel contacts={contacts} projects={projects} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Peter Ratcliffe'))
    const drawer = screen.getByRole('dialog')
    expect(drawer).toBeInTheDocument()
    expect(screen.getByText('supports post-launch')).toBeInTheDocument()
    // project id resolved to its display name inside the drawer
    expect(screen.getByText('WEPort')).toBeInTheDocument()
    // No linkedIn on this contact — no link-out to render.
    expect(screen.queryByText(/linkedin/i)).not.toBeInTheDocument()
  })

  it('renders a LinkedIn link-out only when the contact has one', () => {
    render(<ContactPanel contacts={contacts} projects={projects} />)
    fireEvent.click(screen.getByText('Gavin Schwarz'))
    const link = screen.getByRole('link', { name: /open profile/i })
    expect(link).toHaveAttribute('href', 'https://www.linkedin.com/in/example-gavin')
    expect(link).toHaveAttribute('target', '_blank')
  })
})
