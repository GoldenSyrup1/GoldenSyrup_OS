import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Architecture, ArchKindDef, ArchLink } from '../types'
import {
  addBlock,
  addKind,
  connectBlocks,
  createArchitecture,
  loadArchitectures,
  moveBlock,
  removeBlock,
  removeKind,
  removeLink,
  renameBlock,
  resizeBlock,
  setBlockColor,
  setBlockImage,
  setBlockParent,
  setBlockText,
  updateKind,
  updateLink,
} from '../lib/architecture'
import { pickArchStore } from '../lib/archStore'
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
  addManualBlock: (kind: string) => void
  renameCurrentBlock: (blockId: string, label: string) => void
  deleteBlock: (blockId: string) => void
  deleteLink: (linkId: string) => void
  connect: (source: string, target: string) => void
  reposition: (blockId: string, pos: { x: number; y: number }) => void
  // --- full canvas ---
  recolorBlock: (blockId: string, color: string | undefined) => void
  resize: (blockId: string, size: { width: number; height: number }) => void
  setText: (blockId: string, text: string) => void
  setImage: (blockId: string, src: string) => void
  setParent: (blockId: string, parentId: string | undefined) => void
  styleLink: (linkId: string, patch: Partial<Omit<ArchLink, 'id' | 'source' | 'target'>>) => void
  defineKind: (def: { label: string; color: string; icon: string }) => void
  editKind: (kindId: string, patch: Partial<Omit<ArchKindDef, 'id'>>) => void
  deleteKind: (kindId: string) => void
  buildFromPrompt: (prompt: string) => Promise<void>
  /** 'orchestrator' when diagrams persist to disk; 'local' when browser-only. */
  storeKind: string
  /** Set when a save to disk failed — the canvas is then localStorage-only. */
  storeError: string | null
}

/**
 * Owns the saved architectures: CRUD, persistence, and dispatching a prompt
 * through the architect runner then laying its blocks out and merging them onto
 * the current canvas. All graph edits go through the pure helpers in
 * `lib/architecture.ts` so state stays serialisable.
 *
 * Persistence goes through `archStore`, which is disk-backed when the
 * orchestrator is configured. State still initialises from localStorage so the
 * canvas renders immediately, then reconciles with whatever is on disk.
 */
export function useArchitectures(): ArchitecturesApi {
  const [list, setList] = useState<Architecture[]>(loadArchitectures)
  const [currentId, setCurrentId] = useState<string | null>(() => loadArchitectures()[0]?.id ?? null)
  const [building, setBuilding] = useState(false)
  const [buildNote, setBuildNote] = useState<string | null>(null)
  const [storeError, setStoreError] = useState<string | null>(null)
  const architect = useRef(pickArchitect())
  const store = useRef(pickArchStore())
  // Nothing may be written back until the initial load has resolved: saving the
  // (possibly empty) localStorage list first would wipe the copy on disk.
  const hydrated = useRef(false)

  useEffect(() => {
    let cancelled = false
    store.current
      .load()
      .then((loaded) => {
        if (cancelled) return
        setList(loaded)
        setCurrentId((cur) => (cur && loaded.some((a) => a.id === cur) ? cur : loaded[0]?.id ?? null))
      })
      .finally(() => {
        if (!cancelled) hydrated.current = true
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    store.current.save(list).then(
      () => setStoreError(null),
      (err: unknown) => setStoreError(err instanceof Error ? err.message : String(err)),
    )
  }, [list])

  const current = useMemo(() => list.find((a) => a.id === currentId) ?? null, [list, currentId])

  /** Replace the current architecture in the list with a transformed copy. */
  const mutate = useCallback(
    (fn: (arch: Architecture) => Architecture) => {
      setList((prev) => prev.map((a) => (a.id === currentId ? fn(a) : a)))
    },
    [currentId],
  )

  // Carry the most recent diagram's custom kinds onto a new one, so a block
  // type defined once is reusable instead of redrawn per diagram.
  const create = useCallback((name: string) => {
    setList((prev) => {
      const arch = createArchitecture(name, Date.now(), prev.find((a) => a.kinds?.length)?.kinds ?? [])
      setCurrentId(arch.id)
      return [arch, ...prev]
    })
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
    (kind: string) => {
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
  const recolorBlock = useCallback(
    (blockId: string, color: string | undefined) => mutate((a) => setBlockColor(a, blockId, color, Date.now())),
    [mutate],
  )
  const resize = useCallback(
    (blockId: string, size: { width: number; height: number }) =>
      mutate((a) => resizeBlock(a, blockId, size, Date.now())),
    [mutate],
  )
  const setText = useCallback(
    (blockId: string, text: string) => mutate((a) => setBlockText(a, blockId, text, Date.now())),
    [mutate],
  )
  const setImage = useCallback(
    (blockId: string, src: string) => mutate((a) => setBlockImage(a, blockId, src, Date.now())),
    [mutate],
  )
  const setParent = useCallback(
    (blockId: string, parentId: string | undefined) =>
      mutate((a) => setBlockParent(a, blockId, parentId, Date.now())),
    [mutate],
  )
  const styleLink = useCallback(
    (linkId: string, patch: Partial<Omit<ArchLink, 'id' | 'source' | 'target'>>) =>
      mutate((a) => updateLink(a, linkId, patch, Date.now())),
    [mutate],
  )
  const defineKind = useCallback(
    (def: { label: string; color: string; icon: string }) => mutate((a) => addKind(a, def, Date.now())),
    [mutate],
  )
  const editKind = useCallback(
    (kindId: string, patch: Partial<Omit<ArchKindDef, 'id'>>) =>
      mutate((a) => updateKind(a, kindId, patch, Date.now())),
    [mutate],
  )
  const deleteKind = useCallback(
    (kindId: string) => mutate((a) => removeKind(a, kindId, Date.now())),
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
          // Lay blocks out by their column hint (entry points left, stores right),
          // stacking each column independently so branches don't overlap.
          const rowInCol: Record<number, number> = {}
          patch.blocks.forEach((b) => {
            const col = b.col ?? 0
            const row = rowInCol[col] ?? 0
            rowInCol[col] = row + 1
            const pos = { x: baseX + col * 220, y: 40 + row * 120 }
            next = addBlock(next, b.kind, b.label, pos, Date.now())
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
    recolorBlock,
    resize,
    setText,
    setImage,
    setParent,
    styleLink,
    defineKind,
    editKind,
    deleteKind,
    storeKind: store.current.kind,
    storeError,
  }
}
