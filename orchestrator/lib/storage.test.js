// Storage backends for the durable canvas.
//
// The postgres path is the one that matters on Railway and the one that is
// hardest to eyeball, so it is driven against a fake pool that records every
// statement — that is enough to assert the transaction shape and the prune,
// which are the two ways this could silently eat Sriram's diagrams.

import { mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fileStorage, postgresStorage } from './storage.js'

const arch = (id, name, updatedAt) => ({
  id,
  name,
  blocks: [],
  links: [],
  createdAt: updatedAt,
  updatedAt,
})

const tmp = () => mkdtemp(path.join(tmpdir(), 'gsos-arch-'))

describe('fileStorage', () => {
  it('reads an empty list when the directory does not exist yet', async () => {
    const store = fileStorage(path.join(await tmp(), 'never-created'))
    expect(await store.read()).toEqual([])
  })

  it('round-trips architectures newest first', async () => {
    const store = fileStorage(await tmp())
    await store.write([arch('a', 'Alpha', 100), arch('b', 'Beta', 300)])
    const read = await store.read()
    expect(read.map((a) => a.id)).toEqual(['b', 'a'])
    expect(read[0].name).toBe('Beta')
  })

  it('prunes files for architectures no longer in the payload', async () => {
    const dir = await tmp()
    const store = fileStorage(dir)
    await store.write([arch('a', 'Alpha', 100), arch('b', 'Beta', 200)])
    await store.write([arch('b', 'Beta', 200)])
    expect((await readdir(dir)).filter((n) => n.endsWith('.json'))).toHaveLength(1)
    expect((await store.read()).map((a) => a.id)).toEqual(['b'])
  })

  it('prunes the stale file a rename leaves behind', async () => {
    const dir = await tmp()
    const store = fileStorage(dir)
    await store.write([arch('a', 'Old Name', 100)])
    await store.write([arch('a', 'New Name', 200)])
    const names = (await readdir(dir)).filter((n) => n.endsWith('.json'))
    expect(names).toHaveLength(1)
    expect(await store.read()).toHaveLength(1)
  })

  it('skips an unreadable file instead of failing the whole list', async () => {
    const dir = await tmp()
    const store = fileStorage(dir)
    await store.write([arch('a', 'Alpha', 100)])
    await writeFile(path.join(dir, 'broken.json'), '{ not json', 'utf8')
    expect((await store.read()).map((a) => a.id)).toEqual(['a'])
  })
})

/** A pool that records statements and replays canned rows. */
function fakePool(rows = []) {
  const statements = []
  const client = {
    query: (text, params) => {
      statements.push({ text: text.trim().split('\n')[0].trim(), params })
      return Promise.resolve({ rows: [] })
    },
    release: () => {},
  }
  return {
    statements,
    query: (text, params) => {
      statements.push({ text: text.trim().split('\n')[0].trim(), params })
      return Promise.resolve({ rows })
    },
    connect: () => Promise.resolve(client),
  }
}

const sql = (pool) => pool.statements.map((s) => s.text)

describe('postgresStorage', () => {
  it('creates the table before the first read', async () => {
    const pool = fakePool()
    await postgresStorage(pool).read()
    expect(sql(pool)[0]).toContain('create table if not exists architectures')
  })

  it('only issues the create once across calls', async () => {
    const pool = fakePool()
    const store = postgresStorage(pool)
    await store.read()
    await store.read()
    expect(sql(pool).filter((s) => s.includes('create table')).length).toBe(1)
  })

  it('sanitizes and orders rows coming back off the wire', async () => {
    const pool = fakePool([
      { data: arch('a', 'Alpha', 100) },
      { data: arch('b', 'Beta', 300) },
      { data: { junk: true } },
    ])
    const read = await postgresStorage(pool).read()
    expect(read.map((a) => a.id)).toEqual(['b', 'a'])
  })

  it('writes inside a transaction and prunes ids not in the payload', async () => {
    const pool = fakePool()
    await postgresStorage(pool).write([arch('a', 'Alpha', 100), arch('b', 'Beta', 200)])
    const texts = sql(pool)
    expect(texts).toContain('begin')
    expect(texts).toContain('commit')
    const del = pool.statements.find((s) => s.text.startsWith('delete from architectures where not'))
    expect(del.params[0]).toEqual(['a', 'b'])
    expect(texts.filter((t) => t.startsWith('insert into architectures'))).toHaveLength(2)
  })

  it('clears the table when the payload is empty', async () => {
    const pool = fakePool()
    await postgresStorage(pool).write([])
    expect(sql(pool)).toContain('delete from architectures')
    expect(sql(pool).some((t) => t.startsWith('insert'))).toBe(false)
  })

  it('rolls back and rethrows when a write fails mid-transaction', async () => {
    const pool = fakePool()
    const realConnect = pool.connect
    pool.connect = async () => {
      const client = await realConnect()
      const inner = client.query
      client.query = (text, params) => {
        if (text.trim().startsWith('insert')) return Promise.reject(new Error('disk full'))
        return inner(text, params)
      }
      return client
    }
    await expect(postgresStorage(pool).write([arch('a', 'Alpha', 100)])).rejects.toThrow('disk full')
    expect(sql(pool)).toContain('rollback')
    expect(sql(pool)).not.toContain('commit')
  })
})
