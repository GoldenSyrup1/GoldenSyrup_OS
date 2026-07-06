import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CommandConsole from './CommandConsole'
import { projects } from '../data/seed'

// Fake timers keep the stub runner's delayed steps from firing after the test.
beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('<CommandConsole />', () => {
  it('renders the category tree and disables send until a target + prompt exist', () => {
    render(<CommandConsole projects={projects} />)
    expect(screen.getByText('Startups / Projects')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('dispatches a prompt to the selected target and shows it in the run queue', () => {
    render(<CommandConsole projects={projects} />)

    fireEvent.click(screen.getByRole('button', { name: /WEPort/i }))
    fireEvent.change(screen.getByPlaceholderText(/Prompt for WEPort/i), {
      target: { value: 'find xrpl problemo' },
    })

    const send = screen.getByRole('button', { name: 'Send' })
    expect(send).toBeEnabled()
    fireEvent.click(send)

    // A run appears carrying the prompt; the stub runner marks it running synchronously.
    expect(screen.getByText(/find xrpl problemo/)).toBeInTheDocument()
    expect(screen.getByText('Running')).toBeInTheDocument()
  })
})
