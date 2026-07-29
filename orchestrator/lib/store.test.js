import { describe, expect, it } from 'vitest'
import {
  MAX_ARCHITECTURES,
  archFileName,
  architectureContext,
  renderArchitecture,
  sanitizeArchitecture,
  sanitizeArchitectures,
} from './store.js'

/** A minimal well-formed architecture, overridable per test. */
function arch(over = {}) {
  return {
    id: 'arch-1',
    name: 'WEPort',
    blocks: [
      { id: 'b1', kind: 'client', label: 'Web Client', x: 40, y: 40 },
      { id: 'b2', kind: 'service', label: 'API Service', x: 260, y: 40 },
      { id: 'b3', kind: 'datastore', label: 'Postgres', x: 480, y: 40 },
    ],
    links: [
      { id: 'l1', source: 'b1', target: 'b2' },
      { id: 'l2', source: 'b2', target: 'b3', label: 'writes' },
    ],
    createdAt: 1,
    updatedAt: 2,
    ...over,
  }
}

describe('sanitizeArchitecture', () => {
  it('round-trips a well-formed architecture', () => {
    expect(sanitizeArchitecture(arch())).toEqual(arch())
  })

  it('rejects anything without an id', () => {
    expect(sanitizeArchitecture(null)).toBeNull()
    expect(sanitizeArchitecture({})).toBeNull()
    expect(sanitizeArchitecture(arch({ id: '   ' }))).toBeNull()
  })

  it('falls back on a missing name and an unknown block kind', () => {
    const out = sanitizeArchitecture(
      arch({ name: '', blocks: [{ id: 'b1', kind: 'wormhole', label: '', x: 1, y: 2 }], links: [] }),
    )
    expect(out.name).toBe('Untitled architecture')
    expect(out.blocks[0]).toEqual({ id: 'b1', kind: 'service', label: 'Block', x: 1, y: 2 })
  })

  it('drops duplicate block ids and non-object blocks', () => {
    const out = sanitizeArchitecture(
      arch({
        blocks: [
          { id: 'b1', kind: 'client', label: 'One', x: 0, y: 0 },
          { id: 'b1', kind: 'service', label: 'Dupe', x: 0, y: 0 },
          null,
          { kind: 'service', label: 'No id', x: 0, y: 0 },
        ],
        links: [],
      }),
    )
    expect(out.blocks.map((b) => b.label)).toEqual(['One'])
  })

  // A link to a block that didn't survive sanitisation would render as an arrow
  // from nowhere, so it must be discarded rather than kept dangling.
  it('drops links to missing blocks, self-links and duplicates', () => {
    const out = sanitizeArchitecture(
      arch({
        links: [
          { id: 'l1', source: 'b1', target: 'b2' },
          { id: 'l2', source: 'b1', target: 'b2' }, // duplicate pair
          { id: 'l3', source: 'b1', target: 'b1' }, // self-link
          { id: 'l4', source: 'b1', target: 'ghost' }, // missing target
        ],
      }),
    )
    expect(out.links).toEqual([{ id: 'l1', source: 'b1', target: 'b2' }])
  })

  it('coerces non-numeric positions to 0 and keeps edge labels', () => {
    const out = sanitizeArchitecture(
      arch({ blocks: [{ id: 'b1', kind: 'client', label: 'C', x: 'left', y: NaN }], links: [] }),
    )
    expect(out.blocks[0]).toMatchObject({ x: 0, y: 0 })
    expect(sanitizeArchitecture(arch()).links[1].label).toBe('writes')
  })
})

describe('sanitizeArchitectures', () => {
  it('drops unusable entries and duplicate ids', () => {
    const out = sanitizeArchitectures([arch(), null, arch({ name: 'Dupe id' }), arch({ id: 'arch-2' })])
    expect(out.map((a) => a.id)).toEqual(['arch-1', 'arch-2'])
  })

  it('returns [] for non-arrays', () => {
    expect(sanitizeArchitectures(null)).toEqual([])
    expect(sanitizeArchitectures({ blocks: [] })).toEqual([])
  })

  it('caps the list so a runaway client cannot fill the disk', () => {
    const many = Array.from({ length: MAX_ARCHITECTURES + 20 }, (_, i) => arch({ id: `arch-${i}` }))
    expect(sanitizeArchitectures(many)).toHaveLength(MAX_ARCHITECTURES)
  })
})

describe('archFileName', () => {
  it('slugifies the name and keeps the id for uniqueness', () => {
    expect(archFileName(arch({ name: 'WEPort — Freight Booking!' }))).toBe('weport-freight-booking--arch-1.json')
  })

  it('stays unique when two architectures share a name', () => {
    expect(archFileName(arch())).not.toBe(archFileName(arch({ id: 'arch-2' })))
  })

  it('survives a name with no slug-able characters', () => {
    expect(archFileName(arch({ name: '???' }))).toBe('architecture--arch-1.json')
  })

  // The name is user input and lands in a path — it must not be able to escape
  // the architectures directory.
  it('cannot traverse out of the directory', () => {
    const file = archFileName(arch({ name: '../../etc/passwd', id: '../../evil' }))
    expect(file).not.toContain('/')
    expect(file).not.toContain('..')
  })
})

describe('renderArchitecture', () => {
  it('lists blocks and links by label, not by id', () => {
    const text = renderArchitecture(arch())
    expect(text).toContain('# Architecture: WEPort')
    expect(text).toContain('- Web Client [client]')
    expect(text).toContain('- Web Client -> API Service')
    expect(text).toContain('- API Service -> Postgres (writes)')
    expect(text).not.toContain('b1')
  })

  it('drops pixel positions — topology is the signal', () => {
    expect(renderArchitecture(arch())).not.toContain('480')
  })

  it('says so when there are no blocks or no links', () => {
    expect(renderArchitecture(arch({ blocks: [], links: [] }))).toContain('(empty')
    expect(renderArchitecture(arch({ links: [] }))).toContain('- (none)')
  })
})

describe('architectureContext', () => {
  it('delimits the diagram so it reads as context, not instruction', () => {
    const ctx = architectureContext(arch())
    expect(ctx).toContain('<architecture>')
    expect(ctx).toContain('</architecture>')
    expect(ctx).toContain('# Architecture: WEPort')
    expect(ctx.indexOf('<architecture>')).toBeLessThan(ctx.indexOf('# Architecture'))
  })
})
