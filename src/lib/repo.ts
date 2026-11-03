import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Completion, Data, Goal, Task } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloudEnabled = Boolean(url && key)
export const supabase: SupabaseClient | null = cloudEnabled ? createClient(url!, key!) : null

export type Table = 'goals' | 'tasks' | 'completions'
type Row = Goal | Task | Completion

export interface LoadResult {
  data: Data
  /** true when the server couldn't be reached and the last saved copy was used */
  offline: boolean
}

export interface Repo {
  load(): Promise<LoadResult>
  upsert(table: Table, row: Row): Promise<void>
  remove(table: Table, id: string): Promise<void>
}

const empty = (): Data => ({ goals: [], tasks: [], completions: [] })

/* ------------------------------------------------------------------ */
/* Local-only mode (no Supabase keys): everything lives in this browser */
/* ------------------------------------------------------------------ */
const LS_KEY = 'streakboard.local.v1'

function applyUpsert(d: Data, table: Table, row: Row): Data {
  const list = d[table] as { id: string }[]
  const next = list.some((r) => r.id === row.id) ? list.map((r) => (r.id === row.id ? row : r)) : [...list, row]
  return { ...d, [table]: next } as Data
}

function applyRemove(d: Data, table: Table, id: string): Data {
  const n = { ...d, [table]: (d[table] as { id: string }[]).filter((r) => r.id !== id) } as Data
  if (table === 'tasks') n.completions = d.completions.filter((c) => c.task_id !== id)
  if (table === 'goals') n.tasks = d.tasks.map((t) => (t.goal_id === id ? { ...t, goal_id: null } : t))
  return n
}

export const localRepo: Repo = {
  async load() {
    try {
      return { data: { ...empty(), ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') }, offline: false }
    } catch {
      return { data: empty(), offline: false }
    }
  },
  async upsert(table, row) {
    const { data } = await this.load()
    localStorage.setItem(LS_KEY, JSON.stringify(applyUpsert(data, table, row)))
  },
  async remove(table, id) {
    const { data } = await this.load()
    localStorage.setItem(LS_KEY, JSON.stringify(applyRemove(data, table, id)))
  }
}

/* ------------------------------------------------------------------ */
/* Cloud mode: Supabase + offline cache + queue of unsent changes      */
/* ------------------------------------------------------------------ */
type Op = { t: 'up'; table: Table; row: Row } | { t: 'rm'; table: Table; id: string }

let userKey = 'anon'
export function setCacheUser(id: string | null) {
  userKey = id ?? 'anon'
}
const cacheKey = () => `streakboard.cache.v1.${userKey}`
const queueKey = () => `streakboard.queue.v1.${userKey}`

export function readCache(): Data | null {
  try {
    const raw = localStorage.getItem(cacheKey())
    return raw ? { ...empty(), ...JSON.parse(raw) } : null
  } catch {
    return null
  }
}
export function writeCache(d: Data) {
  try {
    localStorage.setItem(cacheKey(), JSON.stringify(d))
  } catch {
    /* storage full or blocked: skip */
  }
}
export function clearCache(id: string | null) {
  try {
    localStorage.removeItem(`streakboard.cache.v1.${id ?? 'anon'}`)
    localStorage.removeItem(`streakboard.queue.v1.${id ?? 'anon'}`)
  } catch {
    /* ignore */
  }
}

function readQueue(): Op[] {
  try {
    return JSON.parse(localStorage.getItem(queueKey()) || '[]')
  } catch {
    return []
  }
}
function writeQueue(q: Op[]) {
  try {
    localStorage.setItem(queueKey(), JSON.stringify(q))
  } catch {
    /* ignore */
  }
}
export const pendingCount = () => readQueue().length

const isNetworkError = (msg: string) => !navigator.onLine || /fetch|network|load failed|timeout|offline/i.test(msg)

async function send(op: Op): Promise<void> {
  const sb = supabase!
  const { error } = op.t === 'up' ? await sb.from(op.table).upsert(op.row as any) : await sb.from(op.table).delete().eq('id', op.id)
  if (error) throw new Error(error.message)
}

let flushing: Promise<void> | null = null

/** Sends queued changes in order. Stops at the first network failure, drops changes the server rejects. */
export async function flushQueue(): Promise<void> {
  if (flushing) return flushing
  flushing = (async () => {
    let q = readQueue()
    while (q.length > 0) {
      try {
        await send(q[0])
      } catch (e) {
        if (isNetworkError((e as Error).message)) break
        console.warn('Dropping change the server rejected:', (e as Error).message)
      }
      q = q.slice(1)
      writeQueue(q)
    }
  })().finally(() => {
    flushing = null
  })
  return flushing
}

async function run(op: Op): Promise<void> {
  // anything already waiting must go first to keep order
  if (readQueue().length > 0 || !navigator.onLine) {
    writeQueue([...readQueue(), op])
    void flushQueue()
    return
  }
  try {
    await send(op)
  } catch (e) {
    if (isNetworkError((e as Error).message)) writeQueue([...readQueue(), op])
    else throw e
  }
}

export const cloudRepo: Repo = {
  async load() {
    await flushQueue()
    const cached = readCache()
    if (readQueue().length > 0 && cached) return { data: cached, offline: true }
    const sb = supabase!
    try {
      const [g, t, c] = await Promise.all([
        sb.from('goals').select('*'),
        sb.from('tasks').select('*'),
        sb.from('completions').select('*').limit(50000)
      ])
      const err = g.error || t.error || c.error
      if (err) throw new Error(err.message)
      const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
      const data: Data = {
        goals: (g.data ?? []).map((r: any) => ({ ...r, target_value: num(r.target_value) })),
        tasks: (t.data ?? []).map((r: any) => ({ ...r, amount: Number(r.amount), weekly_target: num(r.weekly_target) })),
        completions: (c.data ?? []).map((r: any) => ({ ...r, value: Number(r.value) }))
      }
      writeCache(data)
      return { data, offline: false }
    } catch (e) {
      if (cached && isNetworkError((e as Error).message)) return { data: cached, offline: true }
      throw e
    }
  },
  upsert: (table, row) => run({ t: 'up', table, row }),
  remove: (table, id) => run({ t: 'rm', table, id })
}
