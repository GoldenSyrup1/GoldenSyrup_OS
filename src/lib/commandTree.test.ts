import { describe, it, expect } from 'vitest'
import { isLeaf, flattenLeaves, findNode } from './commandTree'
import type { CommandNode } from '../types'

const tree: CommandNode[] = [
  {
    id: 'a',
    label: 'A',
    children: [
      { id: 'a1', label: 'A1' },
      { id: 'a2', label: 'A2', children: [{ id: 'a2x', label: 'A2X' }] },
    ],
  },
  { id: 'b', label: 'B' },
]

describe('isLeaf', () => {
  it('treats no/empty children as a leaf', () => {
    expect(isLeaf({ id: 'x', label: 'x' })).toBe(true)
    expect(isLeaf({ id: 'x', label: 'x', children: [] })).toBe(true)
    expect(isLeaf(tree[0])).toBe(false)
  })
})

describe('flattenLeaves', () => {
  it('returns only leaf targets, depth-first', () => {
    expect(flattenLeaves(tree).map((n) => n.id)).toEqual(['a1', 'a2x', 'b'])
  })
})

describe('findNode', () => {
  it('finds branch and leaf nodes at any depth', () => {
    expect(findNode(tree, 'a')?.label).toBe('A')
    expect(findNode(tree, 'a2x')?.label).toBe('A2X')
    expect(findNode(tree, 'nope')).toBeUndefined()
  })
})
