// Where architectures actually live.
//
// Two backends behind one interface, chosen by environment rather than by a
// flag anyone has to remember:
//   • filesystem — `architectures/*.json` in the repo. The local default, and
//     the reason an agent working in this checkout can just read the diagrams.
//   • postgres   — a table. What Railway gets, because a container's disk is
//     ephemeral and a redeploy would take the diagrams with it.
//
// The pure shaping (sanitise, filename, render) stays in store.js; this module
// is only I/O.

import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { archFileName, sanitizeArchitecture, sanitizeArchitectures } from './store.js'

/** Newest first — the order both backends return and the UI expects. */
function newestFirst(list) {
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function fileStorage(dir) {
  return {
    kind: 'filesystem',
    describe: () => dir,
    async read() {
      let names
      try {
        names = await readdir(dir)
      } catch (err) {
        if (err.code === 'ENOENT') return []
        throw err
      }
      const parsed = await Promise.all(
        names
          .filter((n) => n.endsWith('.json'))
          .map(async (name) => {
            try {
              return sanitizeArchitecture(JSON.parse(await readFile(path.join(dir, name), 'utf8')))
            } catch {
              // A hand-edited or half-written file shouldn't take the list down.
              console.warn(`architectures: skipping unreadable ${name}`)
              return null
            }
          }),
      )
      return newestFirst(parsed.filter(Boolean))
    },
    async write(list) {
      await mkdir(dir, { recursive: true })
      const keep = new Set()
      for (const arch of list) {
        const file = archFileName(arch)
        keep.add(file)
        await writeFile(path.join(dir, file), `${JSON.stringify(arch, null, 2)}\n`, 'utf8')
      }
      // Prune deleted architectures and the stale file a rename leaves behind
      // (the slug changes, so one id would otherwise sit under two names).
      for (const name of await readdir(dir)) {
        if (name.endsWith('.json') && !keep.has(name)) await unlink(path.join(dir, name))
      }
      return list
    },
  }
}

export function postgresStorage(pool) {
  let ready = null
  const ensure = () => {
    ready ??= pool.query(
      `create table if not exists architectures (
         id text primary key,
         data jsonb not null,
         updated_at bigint not null
       )`,
    )
    return ready
  }

  return {
    kind: 'postgres',
    describe: () => 'postgres',
    async read() {
      await ensure()
      const { rows } = await pool.query('select data from architectures order by updated_at desc')
      return newestFirst(sanitizeArchitectures(rows.map((r) => r.data)))
    },
    async write(list) {
      await ensure()
      const client = await pool.connect()
      try {
        // One transaction: a half-applied save that dropped diagrams without
        // writing their replacements would be the worst possible outcome here.
        await client.query('begin')
        const ids = list.map((a) => a.id)
        if (ids.length) {
          await client.query('delete from architectures where not (id = any($1::text[]))', [ids])
          for (const arch of list) {
            await client.query(
              `insert into architectures (id, data, updated_at) values ($1, $2, $3)
               on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at`,
              [arch.id, arch, arch.updatedAt],
            )
          }
        } else {
          await client.query('delete from architectures')
        }
        await client.query('commit')
      } catch (err) {
        await client.query('rollback').catch(() => {})
        throw err
      } finally {
        client.release()
      }
      return list
    },
  }
}
