import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RadarChart from './RadarChart'
import Timeline from './Timeline'
import ContactPanel from './ContactPanel'
import type { Pillar, Milestone, Contact, Project } from '../types'

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

describe('Timeline', () => {
  const milestones: Milestone[] = [
    { id: 'm1', title: 'Hackathon', kind: 'hackathon', date: '2026-06-30', status: 'progress' },
    { id: 'm2', title: 'Past Event', kind: 'event', date: '2026-06-20', status: 'live' },
  ]

  it('orders milestones by date and shows relative labels', () => {
    render(<Timeline milestones={milestones} now="2026-06-25" />)
    expect(screen.getByText('5d ago')).toBeInTheDocument() // 06-20
    expect(screen.getByText('in 5d')).toBeInTheDocument() // 06-30
  })

  it('handles an empty list', () => {
    render(<Timeline milestones={[]} now="2026-06-25" />)
    expect(screen.getByText(/no upcoming milestones/i)).toBeInTheDocument()
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
  })
})
