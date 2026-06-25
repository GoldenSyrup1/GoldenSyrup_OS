import { useEffect, useState } from 'react'
import type { Pillar } from '../types'
import { pillars as seedPillars } from '../data/seed'
import {
  applyPillarSignals,
  fetchPillarSignals,
  fetchRecentMemories,
  fetchEthPrice,
  type MemoryItem,
} from '../data/adapters'

export type LiveState = 'loading' | 'live' | 'fallback'

export interface LiveData {
  pillars: Pillar[]
  activity: MemoryItem[]
  ethPrice: number | null
  state: LiveState
}

/**
 * Loads the seed layer immediately, then overlays any live data that resolves.
 * Every source is independent and falls back silently, so the UI never blocks.
 */
export function useLiveData(): LiveData {
  const [pillars, setPillars] = useState<Pillar[]>(seedPillars)
  const [activity, setActivity] = useState<MemoryItem[]>([])
  const [ethPrice, setEthPrice] = useState<number | null>(null)
  const [state, setState] = useState<LiveState>('loading')

  useEffect(() => {
    let cancelled = false

    Promise.allSettled([fetchPillarSignals(), fetchRecentMemories(), fetchEthPrice()]).then(
      (results) => {
        if (cancelled) return
        const [signals, memories, price] = results

        let anyLive = false
        if (signals.status === 'fulfilled' && signals.value.length > 0) {
          setPillars(applyPillarSignals(seedPillars, signals.value))
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
      },
    )

    return () => {
      cancelled = true
    }
  }, [])

  return { pillars, activity, ethPrice, state }
}
