import { describe, it, expect } from 'vitest'
import { parsePromptToPatch, coercePatch } from './architect'

/** Resolve a patch's index-based links into readable `role`-ish label pairs. */
function edgeLabels(patch: ReturnType<typeof parsePromptToPatch>): string[] {
  return patch.links.map((l) => `${patch.blocks[l.from].label} → ${patch.blocks[l.to].label}`)
}

describe('parsePromptToPatch', () => {
  it('extracts blocks and wires client → api → downstream (not a flat spine)', () => {
    const patch = parsePromptToPatch('web client talking to an auth service backed by postgres')
    const kinds = patch.blocks.map((b) => b.kind)
    expect(kinds).toContain('client')
    expect(kinds).toContain('service')
    expect(kinds).toContain('datastore')
    const edges = edgeLabels(patch)
    // Client feeds the API, and the API — not the client — fans out to auth + store.
    expect(edges).toContain('Client → API Service')
    expect(edges).toContain('API Service → Auth Service')
    expect(edges).toContain('API Service → Data Store')
    // No spine artifact: the client never links straight to the data store.
    expect(edges).not.toContain('Client → Data Store')
  })

  it('routes an async queue → worker → store pipeline', () => {
    const patch = parsePromptToPatch('api that pushes jobs onto a queue for a worker to write to the database')
    const edges = edgeLabels(patch)
    expect(edges).toContain('API Service → Message Queue')
    expect(edges).toContain('Message Queue → Worker')
    expect(edges).toContain('Worker → Data Store')
  })

  it('hangs an external integration off the worker when one exists', () => {
    const patch = parsePromptToPatch('worker job that calls the stripe payment webhook')
    expect(patch.blocks.some((b) => b.kind === 'external')).toBe(true)
    expect(edgeLabels(patch)).toContain('Worker → External API')
  })

  it('tiers blocks left-to-right by column', () => {
    const patch = parsePromptToPatch('web client, api, postgres database')
    const col = (label: string) => patch.blocks.find((b) => b.label === label)?.col
    expect(col('Client')).toBe(0)
    expect(col('API Service')).toBe(1)
    expect(col('Data Store')).toBe(3)
  })

  it('falls back to a minimal skeleton when nothing matches', () => {
    const patch = parsePromptToPatch('completely unrelated words zzz')
    expect(patch.blocks.map((b) => b.kind)).toEqual(['client', 'service', 'datastore'])
    expect(edgeLabels(patch)).toEqual(['Client → API Service', 'API Service → Data Store'])
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

  it('keeps a valid col hint and drops invalid ones', () => {
    const patch = coercePatch({
      blocks: [
        { kind: 'client', label: 'A', col: 0 },
        { kind: 'service', label: 'B', col: -1 },
        { kind: 'datastore', label: 'C', col: 2.5 },
        { kind: 'service', label: 'D' },
      ],
    })
    expect(patch.blocks.map((b) => b.col)).toEqual([0, undefined, undefined, undefined])
  })

  it('tolerates junk input', () => {
    expect(coercePatch(null)).toEqual({ blocks: [], links: [], note: undefined })
    expect(coercePatch({ blocks: 'no' }).blocks).toEqual([])
  })
})
