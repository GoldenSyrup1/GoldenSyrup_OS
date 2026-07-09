import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Architecture, ArchBlockKind } from '../types'
import {
  addBlock,
  connectBlocks,
  createArchitecture,
  loadArchitectures,
  moveBlock,
  removeBlock,
  removeLink,
  renameBlock,
  saveArchitectures,
} from '../lib/architecture'
import { pickArchitect } from '../lib/architect'

/** Where a prompt's fresh blocks land: a new column to the right of existing content. */
function nextColumnX(arch: Architecture): number {
  if (arch.blocks.length === 0) return 40
  return Math.max(...arch.blocks.map((b) => b.x)) + 240
}

export interface ArchitecturesApi {
  list: Architecture[]
  current: Architecture | null
  currentId: string | null
  building: boolean
  buildNote: string | null
  architectKind: string
  create: (name: string) => void
  select: (id: string) => void
  remove: (id: string) => void
  rename: (name: string) => void
  addManualBlock: (kind: ArchBlockKind) => void
  renameCurrentBlock: (blockId: string, label: string) => void
  deleteBlock: (blockId: string) => void
  deleteLink: (linkId: string) => void
  connect: (source: string, target: string) => void
  reposition: (blockId: string, pos: { x: number; y: number }) => void
  buildFromPrompt: (prompt: string) => Promise<void>
}

/**
 * Owns the saved architectures: CRUD, localStorage persistence, and dispatching a
 * prompt through the architect runner then laying its blocks out and merging them
 * onto the current canvas. All graph edits go through the pure helpers in
 * `lib/architecture.ts` so state stays serialisable.
 */
export function useArchitectures(): ArchitecturesApi {
  const [list, setList] = useState<Architecture[]>(loadArchitectures)
  const [currentId, setCurrentId] = useState<string | null>(() => loadArchitectures()[0]?.id ?? null)
  const [building, setBuilding] = useState(false)
  const [buildNote, setBuildNote] = useState<string | null>(null)
  const architect = useRef(pickArchitect())

  useEffect(() => {
    saveArchitectures(list)
  }, [list])

  const current = useMemo(() => list.find((a) => a.id === currentId) ?? null, [list, currentId])

  /** Replace the current architecture in the list with a transformed copy. */
  const mutate = useCallback(
    (fn: (arch: Architecture) => Architecture) => {
      setList((prev) => prev.map((a) => (a.id === currentId ? fn(a) : a)))
    },
    [currentId],
  )

  const create = useCallback((name: string) => {
    const arch = createArchitecture(name, Date.now())
    setList((prev) => [arch, ...prev])
    setCurrentId(arch.id)
    setBuildNote(null)
  }, [])

  const select = useCallback((id: string) => {
    setCurrentId(id)
    setBuildNote(null)
  }, [])

  const remove = useCallback(
    (id: string) => {
      setList((prev) => {
        const next = prev.filter((a) => a.id !== id)
        setCurrentId((cur) => (cur === id ? next[0]?.id ?? null : cur))
        return next
      })
    },
    [],
  )

  const rename = useCallback(
    (name: string) => {
      const clean = name.trim()
      if (!clean) return
      mutate((a) => ({ ...a, name: clean, updatedAt: Date.now() }))
    },
    [mutate],
  )

  const addManualBlock = useCallback(
    (kind: ArchBlockKind) => {
      mutate((a) => {
        // Stagger placement so successive adds don't stack exactly.
        const x = 60 + (a.blocks.length % 4) * 40
        const y = 60 + a.blocks.length * 30
        return addBlock(a, kind, '', { x, y }, Date.now())
      })
    },
    [mutate],
  )

  const renameCurrentBlock = useCallback(
    (blockId: string, label: string) => mutate((a) => renameBlock(a, blockId, label, Date.now())),
    [mutate],
  )
  const deleteBlock = useCallback(
    (blockId: string) => mutate((a) => removeBlock(a, blockId, Date.now())),
    [mutate],
  )
  const deleteLink = useCallback(
    (linkId: string) => mutate((a) => removeLink(a, linkId, Date.now())),
    [mutate],
  )
  const connect = useCallback(
    (source: string, target: string) => mutate((a) => connectBlocks(a, source, target, Date.now())),
    [mutate],
  )
  const reposition = useCallback(
    (blockId: string, pos: { x: number; y: number }) => mutate((a) => moveBlock(a, blockId, pos, Date.now())),
    [mutate],
  )

  const buildFromPrompt = useCallback(
    async (prompt: string) => {
      const text = prompt.trim()
      if (!text || !currentId) return
      setBuilding(true)
      setBuildNote(null)
      try {
        const patch = await architect.current.build(text)
        mutate((a) => {
          const baseX = nextColumnX(a)
          let next = a
          const newIds: string[] = []
          patch.blocks.forEach((b, i) => {
            next = addBlock(next, b.kind, b.label, { x: baseX, y: 40 + i * 110 }, Date.now())
            newIds.push(next.blocks[next.blocks.length - 1].id)
          })
          patch.links.forEach((l) => {
            const s = newIds[l.from]
            const t = newIds[l.to]
            if (s && t) next = connectBlocks(next, s, t, Date.now())
          })
          return next
        })
        setBuildNote(patch.note ?? `Added ${patch.blocks.length} blocks.`)
      } catch (err) {
        setBuildNote(err instanceof Error ? `Build failed: ${err.message}` : 'Build failed.')
      } finally {
        setBuilding(false)
      }
    },
    [currentId, mutate],
  )

  return {
    list,
    current,
    currentId,
    building,
    buildNote,
    architectKind: architect.current.kind,
    create,
    select,
    remove,
    rename,
    addManualBlock,
    renameCurrentBlock,
    deleteBlock,
    deleteLink,
    connect,
    reposition,
    buildFromPrompt,
  }
}
