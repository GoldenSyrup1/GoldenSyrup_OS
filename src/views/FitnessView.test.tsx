import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import FitnessView from './FitnessView'

beforeEach(() => {
  localStorage.clear()
})

/**
 * Walk the composer: name → create. Opens it from the rail button, which is the
 * one that's present in every board state (the empty state's "+ Add your first
 * ability" is a second way in, so matching both would be ambiguous).
 */
function createAbility(name: string) {
  fireEvent.click(screen.getByRole('button', { name: /New ability/i }))
  fireEvent.change(screen.getByLabelText(/Ability name/i), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: /Create ability/i }))
}

describe('<FitnessView />', () => {
  it('starts empty — the board is Sriram’s manual entry, nothing is seeded', () => {
    render(<FitnessView />)
    expect(screen.getByText(/Track what you can do, not what you did/i)).toBeInTheDocument()
    expect(screen.getByText(/Every value is manual entry/i)).toBeInTheDocument()
  })

  it('creates an ability, adds progression steps, and logs progress toward the skill', () => {
    render(<FitnessView />)
    createAbility('Freestanding handstand')

    expect(screen.getByText('Freestanding handstand')).toBeInTheDocument()
    // No ladder yet, so there is nothing to be a percentage of.
    expect(screen.getByText(/Add the progression steps to start tracking/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Edit ladder/i }))
    const stepField = screen.getByLabelText(/Add a step to Freestanding handstand/i)
    fireEvent.change(stepField, { target: { value: 'Wall handstand' } })
    fireEvent.change(screen.getByLabelText(/Target for the new step/i), { target: { value: '60' } })
    fireEvent.click(screen.getByRole('button', { name: /Add step/i }))

    expect(screen.getByText(/Level 0\/1/i)).toBeInTheDocument()

    // Log half the target → half the ladder owned.
    fireEvent.change(screen.getByLabelText(/Current best for Wall handstand/i), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: /^Log$/i }))
    expect(screen.getByLabelText(/Freestanding handstand 50%/i)).toBeInTheDocument()

    // Hit the target → the rung, and so the ability, is owned.
    fireEvent.change(screen.getByLabelText(/Current best for Wall handstand/i), { target: { value: '60' } })
    fireEvent.click(screen.getByRole('button', { name: /^Log$/i }))
    expect(screen.getByText(/Ability owned/i)).toBeInTheDocument()
    expect(screen.getByText(/Level 1\/1/i)).toBeInTheDocument()
  })

  it('groups abilities under their discipline in the rail', () => {
    render(<FitnessView />)
    createAbility('Pull-up')

    fireEvent.click(screen.getByRole('button', { name: /New ability/i }))
    fireEvent.change(screen.getByLabelText(/Ability name/i), { target: { value: 'Head-height kick' } })
    fireEvent.change(screen.getByLabelText(/^Discipline$/i), { target: { value: 'taekwondo' } })
    fireEvent.click(screen.getByRole('button', { name: /Create ability/i }))

    const rail = screen.getByRole('tablist', { name: /Disciplines/i })
    expect(within(rail).getByText(/Calisthenics/i)).toBeInTheDocument()
    expect(within(rail).getByText(/Taekwondo/i)).toBeInTheDocument()

    // Creating jumps to the new ability's discipline; the other card is filtered out.
    expect(screen.getByText('Head-height kick')).toBeInTheDocument()
    expect(screen.queryByText('Pull-up')).not.toBeInTheDocument()

    fireEvent.click(within(rail).getByRole('tab', { name: /Calisthenics/i }))
    expect(screen.getByText('Pull-up')).toBeInTheDocument()
  })

  it('persists the board to localStorage across remounts', () => {
    const { unmount } = render(<FitnessView />)
    createAbility('Pistol squat')
    unmount()

    render(<FitnessView />)
    expect(screen.getByText('Pistol squat')).toBeInTheDocument()
  })

  it('pauses and deletes an ability', () => {
    render(<FitnessView />)
    createAbility('Muscle-up')

    // The card's own control flips to Resume — "paused" as bare text is ambiguous,
    // since the summary strip also has a "paused" stat label.
    fireEvent.click(screen.getByRole('button', { name: /Pause/i }))
    expect(screen.getByRole('button', { name: /Resume/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Delete/i }))
    expect(screen.queryByText('Muscle-up')).not.toBeInTheDocument()
  })
})
