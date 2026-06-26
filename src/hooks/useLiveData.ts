import { useCallback, useEffect, useRef, useState } from 'react'
import type { Pillar, Project } from '../types'
import { pillars as seedPillars, projects as seedProjects } from '../data/seed'
import {
  applyPillarSignals,
  applyProjectSignals,
  fetchPillarSignals,
  fetchRecentMemories,
  fetchEthPrice,
  fetchWeportStatus,
  type MemoryItem,
} from '../data/adapters'

export type LiveState = 'loading' | 'live' | 'fallback'

/** How often to re-poll live sources (ms). ETH is public, the rest are best-effort. */
const POLL_MS = 90_000

export interface LiveData {
  pillars: Pillar[]
  projects: Project[]
  activity: MemoryItem[]
  ethPrice: number | null
  state: LiveState
  /** Epoch ms of the last completed refresh, or null before the first one. */
  lastUpdated: number | null
  /** Whether a refresh is currently in flight. */
  refreshing: boolean
  /** Manually re-poll every source. */
  refresh: () => void
}

/**
 * Loads the seed layer immediately, then overlays any live data that resolves.
 * Every source is independent and falls back silently, so the UI never blocks.
 * Re-polls on an interval and on demand via `refresh()`.
 */
export function useLiveData(): LiveData {
  const [pillars, setPillars] = useState<Pillar[]>(seedPillars)
  const [projects, setProjects] = useState<Project[]>(seedProjects)
  const [activity, setActivity] = useState<MemoryItem[]>([])
  const [ethPrice, setEthPrice] = useState<number | null>(null)
  const [state, setState] = useState<LiveState>('loading')
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const cancelledRef = useRef(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    const results = await Promise.allSettled([
      fetchPillarSignals(),
      fetchRecentMemories(),
      fetchEthPrice(),
      fetchWeportStatus(),
    ])
    if (cancelledRef.current) return
    const [signals, memories, price, weport] = results

    let anyLive = false
    if (signals.status === 'fulfilled' && signals.value.length > 0) {
      setPillars(applyPillarSignals(seedPillars, signals.value))
      anyLive = true
    }
    if (weport.status === 'fulfilled' && weport.value.length > 0) {
      setProjects(applyProjectSignals(seedProjects, weport.value))
      anyLive = true
    }
    if (memories.status === 'fulfilled' && memories.value.length > 0) {
      setActivity(memories.value)
      anyLive = true
    }
    if (price.status === 'fulfilled' && price.value !== null) {
      setEthPrice(price.value)
      anyLive = true
    }
    setState(anyLive ? 'live' : 'fallback')
    setLastUpdated(Date.now())
    setRefreshing(false)
  }, [])

  useEffect(() => {
    cancelledRef.current = false
    load()
    const id = setInterval(load, POLL_MS)
    return () => {
      cancelledRef.current = true
      clearInterval(id)
    }
  }, [load])

  return { pillars, projects, activity, ethPrice, state, lastUpdated, refreshing, refresh: load }
}
