import { describe, it, expect } from 'vitest'
import { parsePromptToPatch, coercePatch } from './architect'

describe('parsePromptToPatch', () => {
  it('extracts blocks from keywords and wires a spine', () => {
    const patch = parsePromptToPatch('web client talking to an auth service backed by postgres')
    const kinds = patch.blocks.map((b) => b.kind)
    expect(kinds).toContain('client')
    expect(kinds).toContain('service')
    expect(kinds).toContain('datastore')
    // spine: every block after the first is linked from its predecessor
    expect(patch.links).toHaveLength(patch.blocks.length - 1)
    expect(patch.links[0]).toEqual({ from: 0, to: 1 })
  })

  it('detects external integrations', () => {
    const patch = parsePromptToPatch('service that calls the stripe payment webhook')
    expect(patch.blocks.some((b) => b.kind === 'external')).toBe(true)
  })

  it('falls back to a minimal skeleton when nothing matches', () => {
    const patch = parsePromptToPatch('completely unrelated words zzz')
    expect(patch.blocks.map((b) => b.kind)).toEqual(['client', 'service', 'datastore'])
    expect(patch.links).toHaveLength(2)
  })
})

describe('coercePatch', () => {
  it('keeps valid blocks/links and defaults unknown kinds', () => {
    const patch = coercePatch({
      blocks: [{ kind: 'weird', label: 'X' }, { kind: 'datastore', label: 'DB' }],
      links: [{ from: 0, to: 1 }],
    })
    expect(patch.blocks[0].kind).toBe('service') // unknown → service
    expect(patch.blocks[1].kind).toBe('datastore')
    expect(patch.links).toHaveLength(1)
  })

  it('drops links with out-of-range or non-integer indices', () => {
    const patch = coercePatch({
      blocks: [{ kind: 'service', label: 'A' }],
      links: [{ from: 0, to: 5 }, { from: 0, to: 0.5 }, { from: -1, to: 0 }],
    })
    expect(patch.links).toEqual([])
  })

  it('tolerates junk input', () => {
    expect(coercePatch(null)).toEqual({ blocks: [], links: [], note: undefined })
    expect(coercePatch({ blocks: 'no' }).blocks).toEqual([])
  })
})
