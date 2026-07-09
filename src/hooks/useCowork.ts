import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CoworkCategory, CoworkTask } from '../types'
import { aggregateByCategory, fetchCoworkState } from '../data/cowork'

/** Poll cadence for the local bridge file (ms). Cheap local read, so fairly tight. */
const POLL_MS = 15_000

export type CoworkConnection = 'loading' | 'connected' | 'absent'

export interface CoworkData {
  tasks: CoworkTask[]
  categories: CoworkCategory[]
  connection: CoworkConnection
  generatedAt: string | null
  lastUpdated: number | null
  refreshing: boolean
  refresh: () => void
}

/**
 * Reads the Cowork bridge file (see `data/cowork.ts`), rolls tasks up into
 * categories, and re-polls on an interval + on demand. `connection` is 'absent'
 * when no tasks are found — the expected state on the static deploy or before the
 * desktop folder is connected — so the view can explain how to wire it.
 */
export function useCowork(): CoworkData {
  const [tasks, setTasks] = useState<CoworkTask[]>([])
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [connection, setConnection] = useState<CoworkConnection>('loading')
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const cancelledRef = useRef(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    const state = await fetchCoworkState()
    if (cancelledRef.current) return
    setTasks(state.tasks)
    setGeneratedAt(state.generatedAt ?? null)
    setConnection(state.tasks.length > 0 ? 'connected' : 'absent')
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

  const categories = useMemo(() => aggregateByCategory(tasks), [tasks])

  return { tasks, categories, connection, generatedAt, lastUpdated, refreshing, refresh: load }
}
