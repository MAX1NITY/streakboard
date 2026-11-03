import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { clearCache, cloudEnabled, supabase } from './lib/repo'
import { useStore } from './store'
import Auth from './components/Auth'
import Today from './components/Today'
import Stats from './components/Stats'
import Year from './components/Year'
import Goals from './components/Goals'
import Settings from './components/Settings'
import { startReminders } from './lib/reminders'
import { completionMap, dayPlan } from './lib/stats'
import { today } from './lib/dates'
import type { Scope } from './components/ScopePicker'

type Tab = 'today' | 'stats' | 'year' | 'goals'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '✓' },
  { id: 'stats', label: 'Stats', icon: '▤' },
  { id: 'year', label: 'Year', icon: '▦' },
  { id: 'goals', label: 'Goals', icon: '◎' }
]

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!cloudEnabled)
  const [tab, setTab] = useState<Tab>('today')
  const [scope, setScope] = useState<Scope>({ kind: 'all' })

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const [showSettings, setShowSettings] = useState(false)
  const store = useStore(cloudEnabled, session?.user.id ?? null)

  // daily reminder: look at what is still undone right now
  const dataRef = useRef(store.data)
  dataRef.current = store.data
  useEffect(
    () =>
      startReminders(() => {
        const d = dataRef.current
        const { due } = dayPlan(d.tasks, completionMap(d.completions), today())
        const cm = completionMap(d.completions)
        const left = due.filter((t) => !cm.has(t.id + '|' + today()))
        return { count: left.length, names: left.map((t) => t.title) }
      }),
    []
  )
  const signOut = async () => {
    const id = session?.user.id ?? null
    await supabase!.auth.signOut()
    clearCache(id)
  }

  if (!authReady) return <div className="splash">Loading…</div>
  if (cloudEnabled && !session) return <Auth />

  const { data } = store
  return (
    <div className="app">
      <header className="top">
        <span className="brand">Streakboard</span>
        <span className="grow" />
        {!cloudEnabled && <span className="tag warn" title="Supabase isn't configured, so data is stored only on this device">Local only</span>}
        {store.offline && <span className="tag warn" title="Changes are saved on this device and will sync when you're back online">Offline{store.pending > 0 ? ` · ${store.pending} to sync` : ''}</span>}
        <button className="icon small-i" onClick={() => setShowSettings(true)} aria-label="Settings">⚙</button>
      </header>

      {store.error && (
        <div className="banner" role="alert">
          {store.error} <button className="link" onClick={store.clearError}>Dismiss</button>
        </div>
      )}

      <main>
        {store.loading ? <div className="splash">Loading…</div> : (
          <>
            {tab === 'today' && <Today data={data} toggle={store.toggle} setAmount={store.setAmount} save={store.save as any} del={store.del as any} />}
            {tab === 'stats' && <Stats data={data} scope={scope} setScope={setScope} />}
            {tab === 'year' && <Year data={data} scope={scope} setScope={setScope} />}
            {tab === 'goals' && <Goals data={data} save={store.save as any} del={store.del as any} />}
          </>
        )}
      </main>

      {showSettings && <Settings onClose={() => setShowSettings(false)} email={session?.user.email} onSignOut={cloudEnabled ? signOut : undefined} />}

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
