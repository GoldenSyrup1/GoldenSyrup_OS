import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CommandConsole from './CommandConsole'
import { useCommandConsole } from '../hooks/useCommandConsole'
import { useMilestoneBoard } from '../hooks/useMilestoneBoard'
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

// App owns the single `useCommandConsole()` / `useMilestoneBoard()` instances in
// real usage; this wrapper mirrors that so the component is exercised the same
// way it's actually used.
function Wrapper() {
  const consoleApi = useCommandConsole()
  const milestoneBoard = useMilestoneBoard()
  return <CommandConsole projects={projects} consoleApi={consoleApi} milestoneBoard={milestoneBoard} />
}

describe('<CommandConsole />', () => {
  it('renders the tool selector and disables send until a tool + prompt exist', () => {
    render(<Wrapper />)
    expect(screen.getByLabelText(/tool selection/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('dispatches a prompt to the selected tool and shows it in the chat window', () => {
    render(<Wrapper />)

    fireEvent.change(screen.getByLabelText(/tool selection/i), { target: { value: 't-weport' } })
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

  it('clearing the project selection back to "all" resets a tool from a different project', () => {
    render(<Wrapper />)
    fireEvent.change(screen.getByLabelText(/tool selection/i), { target: { value: 't-weport' } })
    fireEvent.change(screen.getByLabelText(/project selection/i), { target: { value: 'goldensyrup-intel' } })
    // WEPort doesn't belong to GoldenSyrup_Intel, so the mismatched tool clears.
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('handles a /milestone chat command locally, with no tool selected', () => {
    render(<Wrapper />)
    fireEvent.change(screen.getByPlaceholderText(/pick a tool below/i), {
      target: { value: '/milestone Shipped the OS redesign #hackathon' },
    })

    const send = screen.getByRole('button', { name: 'Send' })
    expect(send).toBeEnabled()
    fireEvent.click(send)

    expect(screen.getByText(/Milestone added/i)).toBeInTheDocument()
    // The command never reaches the runner — no run/chat bubble appears for it.
    expect(screen.queryByText(/Shipped the OS redesign/)).not.toBeInTheDocument()
  })
})
