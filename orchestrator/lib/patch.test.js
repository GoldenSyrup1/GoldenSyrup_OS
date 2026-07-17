import { describe, expect, it } from 'vitest'
import { ARCHITECTURE_SCHEMA, MAX_BLOCKS, toPatch } from './patch.js'

describe('ARCHITECTURE_SCHEMA', () => {
  // Structured outputs reject a schema whose objects allow extra properties or
  // leave properties out of `required`, so assert the shape the API demands.
  it('closes every object and requires every property', () => {
    const objects = [
      ARCHITECTURE_SCHEMA,
      ARCHITECTURE_SCHEMA.properties.blocks.items,
      ARCHITECTURE_SCHEMA.properties.links.items,
    ]
    for (const o of objects) {
      expect(o.additionalProperties).toBe(false)
      expect(o.required.sort()).toEqual(Object.keys(o.properties).sort())
    }
  })

  it('offers exactly the canvas block kinds', () => {
    expect(ARCHITECTURE_SCHEMA.properties.blocks.items.properties.kind.enum.sort()).toEqual(
      ['client', 'datastore', 'external', 'note', 'queue', 'service'],
    )
  })
})

describe('toPatch', () => {
  it('passes a well-formed payload through', () => {
    const patch = toPatch({
      blocks: [
        { kind: 'client', label: 'Web App', col: 0 },
        { kind: 'service', label: 'API', col: 1 },
      ],
      links: [{ from: 0, to: 1, label: 'HTTPS' }],
      note: 'Two blocks.',
    })
    expect(patch.blocks).toEqual([
      { kind: 'client', label: 'Web App', col: 0 },
      { kind: 'service', label: 'API', col: 1 },
    ])
    expect(patch.links).toEqual([{ from: 0, to: 1, label: 'HTTPS' }])
    expect(patch.note).toBe('Two blocks.')
  })

  it('falls back on an unknown kind, blank label, and bad col', () => {
    const patch = toPatch({ blocks: [{ kind: 'kubernetes', label: '   ', col: -3 }], links: [] })
    expect(patch.blocks).toEqual([{ kind: 'service', label: 'Block', col: undefined }])
  })

  it('re-indexes links around a dropped block instead of mis-wiring them', () => {
    // Block 1 is junk. Block 2 slides into index 1 — the 0->2 link must follow
    // it there, and the link to the dropped block must vanish, not retarget.
    const patch = toPatch({
      blocks: [{ kind: 'client', label: 'Web', col: 0 }, null, { kind: 'datastore', label: 'DB', col: 2 }],
      links: [
        { from: 0, to: 2, label: 'reads' },
        { from: 0, to: 1, label: 'to the dropped block' },
      ],
    })
    expect(patch.blocks.map((b) => b.label)).toEqual(['Web', 'DB'])
    expect(patch.links).toEqual([{ from: 0, to: 1, label: 'reads' }])
  })

  it('drops out-of-range, self, and duplicate links', () => {
    const patch = toPatch({
      blocks: [
        { kind: 'client', label: 'A', col: 0 },
        { kind: 'service', label: 'B', col: 1 },
      ],
      links: [
        { from: 0, to: 1, label: '' },
        { from: 0, to: 1, label: 'dupe' },
        { from: 1, to: 1, label: 'self' },
        { from: 0, to: 9, label: 'out of range' },
        { from: -1, to: 0, label: 'negative' },
      ],
    })
    expect(patch.links).toEqual([{ from: 0, to: 1, label: undefined }])
  })

  it('caps blocks and discards links into the capped-off tail', () => {
    const blocks = Array.from({ length: MAX_BLOCKS + 5 }, (_, i) => ({
      kind: 'service',
      label: `S${i}`,
      col: 0,
    }))
    const patch = toPatch({ blocks, links: [{ from: 0, to: MAX_BLOCKS + 1, label: 'past the cap' }] })
    expect(patch.blocks).toHaveLength(MAX_BLOCKS)
    expect(patch.links).toEqual([])
  })

  it('truncates an overlong label', () => {
    const patch = toPatch({ blocks: [{ kind: 'service', label: 'x'.repeat(200), col: 0 }], links: [] })
    expect(patch.blocks[0].label).toHaveLength(60)
  })

  it('survives junk payloads', () => {
    for (const junk of [null, undefined, 'nope', 42, {}, { blocks: 'no', links: 'no' }]) {
      expect(toPatch(junk)).toEqual({ blocks: [], links: [], note: undefined })
    }
  })
})
