import { useCallback, useEffect, useRef, useState } from 'react'
import type { Architecture } from '../types'
import { addBlock, addFreehandBlock, connectBlocks, moveBlock, removeBlock, removeLink, renameBlock, resizeBlock } from '../lib/architecture'
import {
  appendMilestoneNode,
  loadMilestoneBoard,
  parseMilestoneCommand,
  saveMilestoneBoard,
  seedMilestoneBoard,
} from '../lib/milestoneBoard'
import { milestones as seedMilestones } from '../data/seed'

export interface MilestoneBoardApi {
  board: Architecture | null
  addShape: (kind: string, pos: { x: number; y: number }) => void
  addStroke: (points: { x: number; y: number }[]) => void
  connect: (source: string, target: string) => void
  reposition: (blockId: string, pos: { x: number; y: number }) => void
  resize: (blockId: string, size: { width: number; height: number }) => void
  renameBlock: (blockId: string, label: string) => void
  deleteBlock: (blockId: string) => void
  deleteLink: (linkId: string) => void
  /** Handles a `/milestone …` chat command; returns false if `text` wasn't one. */
  tryAddAchievement: (text: string) => boolean
}

/**
 * Owns the single Milestones board: seeds it once (from the existing
 * `Milestone[]` seed data) the first time it's ever opened, then every edit —
 * hand-drawn or chat-appended — goes through the same pure ops
 * `lib/architecture.ts` already provides, persisted to its own localStorage
 * key. See `lib/milestoneBoard.ts` for why this doesn't share storage with
 * `useArchitectures`.
 */
export function useMilestoneBoard(): MilestoneBoardApi {
  const [board, setBoard] = useState<Architecture | null>(() => {
    const existing = loadMilestoneBoard()
    if (existing) return existing
    // First-ever open: seed from the milestones already tracked in seed.ts
    // rather than starting from a blank canvas.
    return seedMilestoneBoard(seedMilestones, Date.now())
  })
  const seq = useRef(0)
  const nextSeed = useCallback(() => Date.now() + seq.current++, [])

  useEffect(() => {
    if (board) saveMilestoneBoard(board)
  }, [board])

  const mutate = useCallback((fn: (a: Architecture) => Architecture) => {
    setBoard((prev) => (prev ? fn(prev) : prev))
  }, [])

  const addShape = useCallback(
    (kind: string, pos: { x: number; y: number }) => mutate((a) => addBlock(a, kind, '', pos, nextSeed())),
    [mutate, nextSeed],
  )
  const addStroke = useCallback(
    (points: { x: number; y: number }[]) => mutate((a) => addFreehandBlock(a, points, nextSeed())),
    [mutate, nextSeed],
  )
  const connect = useCallback(
    (source: string, target: string) => mutate((a) => connectBlocks(a, source, target, nextSeed())),
    [mutate, nextSeed],
  )
  const reposition = useCallback(
    (blockId: string, pos: { x: number; y: number }) => mutate((a) => moveBlock(a, blockId, pos, nextSeed())),
    [mutate, nextSeed],
  )
  const resize = useCallback(
    (blockId: string, size: { width: number; height: number }) =>
      mutate((a) => resizeBlock(a, blockId, size, nextSeed())),
    [mutate, nextSeed],
  )
  const renameBlockCb = useCallback(
    (blockId: string, label: string) => mutate((a) => renameBlock(a, blockId, label, nextSeed())),
    [mutate, nextSeed],
  )
  const deleteBlock = useCallback((blockId: string) => mutate((a) => removeBlock(a, blockId, nextSeed())), [mutate, nextSeed])
  const deleteLink = useCallback((linkId: string) => mutate((a) => removeLink(a, linkId, nextSeed())), [mutate, nextSeed])

  const tryAddAchievement = useCallback(
    (text: string) => {
      const parsed = parseMilestoneCommand(text)
      if (!parsed) return false
      mutate((a) => appendMilestoneNode(a, parsed, nextSeed()))
      return true
    },
    [mutate, nextSeed],
  )

  return {
    board,
    addShape,
    addStroke,
    connect,
    reposition,
    resize,
    renameBlock: renameBlockCb,
    deleteBlock,
    deleteLink,
    tryAddAchievement,
  }
}
