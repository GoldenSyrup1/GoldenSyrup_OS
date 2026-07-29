import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Architecture } from '../types'
import { localArchStore, mergeArchitectures, orchestratorArchStore } from './archStore'
import { saveArchitectures } from './architecture'

function arch(over: Partial<Architecture> = {}): Architecture {
  return {
    id: 'arch-1',
    name: 'WEPort',
    blocks: [{ id: 'b1', kind: 'client', label: 'Web Client', x: 0, y: 0 }],
    links: [],
    createdAt: 1,
    updatedAt: 2,
    ...over,
  }
}

const BASE = 'http://localhost:8787'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('localArchStore', () => {
  it('round-trips through localStorage', async () => {
    await localArchStore.save([arch()])
    expect(await localArchStore.load()).toEqual([arch()])
  })

  it('starts empty', async () => {
    expect(await localArchStore.load()).toEqual([])
  })
})

describe('mergeArchitectures', () => {
  it('unions by id', () => {
    const merged = mergeArchitectures([arch({ id: 'a', updatedAt: 1 })], [arch({ id: 'b', updatedAt: 2 })])
    expect(merged.map((a) => a.id)).toEqual(['b', 'a'])
  })

  it('lets the newer updatedAt win a conflict, whichever side it is on', () => {
    const remoteWins = mergeArchitectures(
      [arch({ id: 'a', name: 'disk', updatedAt: 9 })],
      [arch({ id: 'a', name: 'browser', updatedAt: 2 })],
    )
    expect(remoteWins[0].name).toBe('disk')

    const localWins = mergeArchitectures(
      [arch({ id: 'a', name: 'disk', updatedAt: 2 })],
      [arch({ id: 'a', name: 'browser', updatedAt: 9 })],
    )
    expect(localWins[0].name).toBe('browser')
  })

  it('sorts newest first', () => {
    const merged = mergeArchitectures(
      [arch({ id: 'a', updatedAt: 1 }), arch({ id: 'c', updatedAt: 30 })],
      [arch({ id: 'b', updatedAt: 20 })],
    )
    expect(merged.map((a) => a.id)).toEqual(['c', 'b', 'a'])
  })

  it('handles either side being empty', () => {
    expect(mergeArchitectures([], [arch()])).toHaveLength(1)
    expect(mergeArchitectures([arch()], [])).toHaveLength(1)
    expect(mergeArchitectures([], [])).toEqual([])
  })
})

describe('orchestratorArchStore', () => {
  it('loads from the orchestrator and caches to localStorage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ architectures: [arch()] }) }),
    )
    const store = orchestratorArchStore(BASE)
    expect(await store.load()).toEqual([arch()])
    // Cached, so a later offline load still has the diagram.
    expect(await localArchStore.load()).toEqual([arch()])
  })

  // An unreachable orchestrator must degrade to the old localStorage-only
  // behaviour, not to a blank canvas that then overwrites disk with nothing.
  it('falls back to the localStorage cache when the load fails', async () => {
    saveArchitectures([arch({ name: 'Cached' })])
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    expect((await orchestratorArchStore(BASE).load())[0].name).toBe('Cached')
  })

  it('falls back when the orchestrator answers non-2xx', async () => {
    saveArchitectures([arch({ name: 'Cached' })])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    expect((await orchestratorArchStore(BASE).load())[0].name).toBe('Cached')
  })

  it('drops malformed entries the orchestrator returned', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ architectures: [arch(), { id: 'x' }, null] }) }),
    )
    expect(await orchestratorArchStore(BASE).load()).toHaveLength(1)
  })

  it('tolerates a body with no architectures key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    expect(await orchestratorArchStore(BASE).load()).toEqual([])
  })

  // The migration case: diagrams drawn before the orchestrator existed must be
  // adopted onto disk, not silently replaced by an empty disk.
  it('adopts browser-only diagrams instead of letting an empty disk win', async () => {
    saveArchitectures([arch({ id: 'browser-only', name: 'Drawn before the orchestrator' })])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ architectures: [] }) }))

    const merged = await orchestratorArchStore(BASE).load()
    expect(merged.map((a) => a.name)).toEqual(['Drawn before the orchestrator'])
    // …and the merge is cached, so the hook's write-back puts it on disk.
    expect(await localArchStore.load()).toHaveLength(1)
  })

  it('keeps both sides when disk and browser hold different diagrams', async () => {
    saveArchitectures([arch({ id: 'local-1', name: 'Local', updatedAt: 5 })])
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ architectures: [arch({ id: 'disk-1', name: 'Disk', updatedAt: 7 })] }),
      }),
    )
    expect((await orchestratorArchStore(BASE).load()).map((a) => a.name)).toEqual(['Disk', 'Local'])
  })

  it('PUTs the whole list on save', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    await orchestratorArchStore(BASE).save([arch()])

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE}/architectures`)
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ architectures: [arch()] })
  })

  // Silently losing a diagram the user believes is on disk is worth an error.
  it('rejects when the save fails, after writing the local cache', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 507 }))
    await expect(orchestratorArchStore(BASE).save([arch()])).rejects.toThrow('507')
    expect(await localArchStore.load()).toEqual([arch()])
  })
})
