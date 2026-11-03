import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cloudRepo, localRepo, pendingCount, setCacheUser, writeCache, type Repo, type Table } from './lib/repo'
import type { Completion, Data, Goal, Task } from './lib/types'
import { uid } from './lib/dates'

const empty: Data = { goals: [], tasks: [], completions: [] }

export function useStore(cloud: boolean, userId: string | null) {
  const signedIn = Boolean(userId)
  const repo: Repo = useMemo(() => (cloud ? cloudRepo : localRepo), [cloud])
  const [data, setData] = useState<Data>(empty)
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [pending, setPending] = useState(0)
  const dataRef = useRef(data)
  dataRef.current = data

  const reload = useCallback(async () => {
    try {
      const r = await repo.load()
      setData(r.data)
      setOffline(r.offline)
      setError(null)
      setLoaded(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPending(cloud ? pendingCount() : 0)
      setLoading(false)
    }
  }, [repo, cloud])

  useEffect(() => {
    if (cloud) setCacheUser(userId)
    if (cloud && !signedIn) {
      setData(empty)
      setLoaded(false)
      setLoading(false)
      return
    }
    setLoading(true)
    reload()
  }, [cloud, signedIn, userId, reload])

  // keep an offline copy of everything that is on screen
  useEffect(() => {
    if (cloud && signedIn && loaded) writeCache(data)
  }, [cloud, signedIn, loaded, data])

  // phone + computer stay in sync: refresh on focus and when the connection returns
  useEffect(() => {
    if (!cloud || !signedIn) return
    const refresh = () => reload()
    const onVis = () => document.visibilityState === 'visible' && refresh()
    const onOffline = () => setOffline(true)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', refresh)
    window.addEventListener('offline', onOffline)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', onOffline)
    }
  }, [cloud, signedIn, reload])

  const afterWrite = useCallback(() => {
    if (cloud) {
      setPending(pendingCount())
      if (!navigator.onLine) setOffline(true)
    }
  }, [cloud])

  /** Optimistic write: update the screen first, roll back by reloading if the server rejects it. */
  const save = useCallback(
    async (table: Table, row: Goal | Task | Completion) => {
      setData((d) => {
        const list = d[table] as { id: string }[]
        const next = list.some((r) => r.id === row.id) ? list.map((r) => (r.id === row.id ? row : r)) : [...list, row]
        return { ...d, [table]: next } as Data
      })
      try {
        await repo.upsert(table, row)
        afterWrite()
      } catch (e) {
        setError((e as Error).message)
        reload()
      }
    },
    [repo, reload, afterWrite]
  )

  const del = useCallback(
    async (table: Table, id: string) => {
      setData((d) => {
        const n = { ...d, [table]: (d[table] as { id: string }[]).filter((r) => r.id !== id) } as Data
        if (table === 'tasks') n.completions = d.completions.filter((c) => c.task_id !== id)
        if (table === 'goals') n.tasks = d.tasks.map((t) => (t.goal_id === id ? { ...t, goal_id: null } : t))
        return n
      })
      try {
        await repo.remove(table, id)
        afterWrite()
      } catch (e) {
        setError((e as Error).message)
        reload()
      }
    },
    [repo, reload, afterWrite]
  )

  const toggle = useCallback(
    async (task: Task, date: string) => {
      const existing = dataRef.current.completions.find((c) => c.task_id === task.id && c.date === date)
      if (existing) await del('completions', existing.id)
      else await save('completions', { id: uid(), task_id: task.id, date, value: task.amount })
    },
    [save, del]
  )

  /** Log a specific amount for a day (e.g. ran 7 km instead of the usual 5). Creates the completion if needed. */
  const setAmount = useCallback(
    async (task: Task, date: string, value: number) => {
      const existing = dataRef.current.completions.find((c) => c.task_id === task.id && c.date === date)
      await save('completions', { id: existing?.id ?? uid(), task_id: task.id, date, value })
    },
    [save]
  )

  return { data, loading, error, offline, pending, clearError: () => setError(null), save, del, toggle, setAmount, reload }
}
