import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Architecture } from '../types'
import { localArchStore, orchestratorArchStore } from './archStore'
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
