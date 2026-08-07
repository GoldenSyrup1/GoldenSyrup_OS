import { describe, it, expect } from 'vitest'
import type { Milestone } from '../types'
import {
  appendMilestoneNode,
  parseMilestoneBoard,
  parseMilestoneCommand,
  seedMilestoneBoard,
  MILESTONE_BOARD_ID,
} from './milestoneBoard'

const milestones: Milestone[] = [
  { id: 'm1', title: 'Hackathon', kind: 'hackathon', date: '2026-06-30', status: 'progress' },
  { id: 'm2', title: 'Past Event', kind: 'event', date: '2026-06-20', status: 'live' },
  { id: 'm3', title: 'UNSW deadline', kind: 'unsw', date: '2026-07-10', status: 'idle' },
]

describe('seedMilestoneBoard', () => {
  it('lays out one shape block per milestone, ordered by date', () => {
    const board = seedMilestoneBoard(milestones, 1000)
    expect(board.id).toBe(MILESTONE_BOARD_ID)
    expect(board.blocks).toHaveLength(3)
    expect(board.blocks.map((b) => b.label)).toEqual(['Past Event', 'Hackathon', 'UNSW deadline'])
  })

  it('maps each milestone kind to its drawing shape', () => {
    const board = seedMilestoneBoard(milestones, 1000)
    const byLabel = Object.fromEntries(board.blocks.map((b) => [b.label, b.kind]))
    expect(byLabel['Hackathon']).toBe('shape-diamond')
    expect(byLabel['Past Event']).toBe('shape-circle')
    expect(byLabel['UNSW deadline']).toBe('shape-rect')
  })

  it('chains consecutive milestones with links', () => {
    const board = seedMilestoneBoard(milestones, 1000)
    expect(board.links).toHaveLength(2)
    const first = board.blocks[0]
    const second = board.blocks[1]
    expect(board.links[0]).toMatchObject({ source: first.id, target: second.id })
  })

  it('is a no-op-safe empty board for an empty milestone list', () => {
    const board = seedMilestoneBoard([], 1000)
    expect(board.blocks).toHaveLength(0)
    expect(board.links).toHaveLength(0)
  })
})

describe('parseMilestoneCommand', () => {
  it('parses a bare title with no tag as an "event"', () => {
    expect(parseMilestoneCommand('/milestone Shipped the OS redesign')).toEqual({
      title: 'Shipped the OS redesign',
      kind: 'event',
    })
  })

  it('parses a #hackathon tag and strips it from the title', () => {
    expect(parseMilestoneCommand('/milestone Won CockroachDB hackathon #hackathon')).toEqual({
      title: 'Won CockroachDB hackathon',
      kind: 'hackathon',
    })
  })

  it('accepts #uni as an alias for the unsw kind', () => {
    expect(parseMilestoneCommand('/milestone Finished COMP3900 #uni')).toEqual({
      title: 'Finished COMP3900',
      kind: 'unsw',
    })
  })

  it('is case-insensitive on both the command and the tag', () => {
    expect(parseMilestoneCommand('/MILESTONE Something #HACKATHON')).toEqual({
      title: 'Something',
      kind: 'hackathon',
    })
  })

  it('returns null for text that is not a /milestone command', () => {
    expect(parseMilestoneCommand('just a normal prompt')).toBeNull()
  })

  it('returns null for a title-less command', () => {
    expect(parseMilestoneCommand('/milestone')).toBeNull()
    expect(parseMilestoneCommand('/milestone    ')).toBeNull()
  })

  it('returns null when the title is only an unrecognised tag', () => {
    expect(parseMilestoneCommand('/milestone #notarealtag')).not.toBeNull()
    // An unrecognised tag isn't stripped (it's not a kind keyword), so it
    // just becomes part of the title instead of leaving nothing behind.
    expect(parseMilestoneCommand('/milestone #notarealtag')?.title).toBe('#notarealtag')
  })
})

describe('appendMilestoneNode', () => {
  it('adds a block chained after the current rightmost block', () => {
    const board = seedMilestoneBoard(milestones, 1000)
    const rightmostBefore = Math.max(...board.blocks.map((b) => b.x))

    const next = appendMilestoneNode(board, { title: 'New win', kind: 'hackathon' }, 2000)

    expect(next.blocks).toHaveLength(4)
    const added = next.blocks[next.blocks.length - 1]
    expect(added.label).toBe('New win')
    expect(added.kind).toBe('shape-diamond')
    expect(added.x).toBeGreaterThan(rightmostBefore)
    expect(next.links.some((l) => l.target === added.id)).toBe(true)
  })

  it('handles an empty board without crashing (first-ever chat milestone)', () => {
    const empty = seedMilestoneBoard([], 1000)
    const next = appendMilestoneNode(empty, { title: 'First win', kind: 'event' }, 2000)
    expect(next.blocks).toHaveLength(1)
    expect(next.links).toHaveLength(0)
  })
})

describe('parseMilestoneBoard', () => {
  it('returns null for missing / malformed JSON', () => {
    expect(parseMilestoneBoard(null)).toBeNull()
    expect(parseMilestoneBoard('{not json')).toBeNull()
    expect(parseMilestoneBoard('{"a":1}')).toBeNull()
  })

  it('round-trips a well-shaped board', () => {
    const board = seedMilestoneBoard(milestones, 1000)
    expect(parseMilestoneBoard(JSON.stringify(board))).toEqual(board)
  })
})
