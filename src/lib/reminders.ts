import { today } from './dates'

export interface ReminderSettings {
  enabled: boolean
  time: string // HH:MM, local
}

const KEY = 'streakboard.reminders.v1'
const SENT = 'streakboard.reminders.lastSent'

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window

export function getReminders(): ReminderSettings {
  try {
    return { enabled: false, time: '20:00', ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { enabled: false, time: '20:00' }
  }
}

export function saveReminders(s: ReminderSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
    localStorage.removeItem(SENT) // allow it to fire again today if the time was moved
  } catch {
    /* ignore */
  }
}

export async function askPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

async function show(title: string, body: string) {
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    if (reg) return void (await reg.showNotification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'streakboard-daily' }))
  } catch {
    /* fall through */
  }
  new Notification(title, { body, icon: '/icon-192.png' })
}

/**
 * Checks every 30s (and when the app returns to the foreground) whether it's past the
 * reminder time and something is still undone today. Fires at most once per day.
 * This works while the app is open or running in the background; browsers don't wake
 * a fully closed web app, so it can't fire from nothing.
 */
export function startReminders(pending: () => { count: number; names: string[] }): () => void {
  const tick = () => {
    const s = getReminders()
    if (!s.enabled || !notificationsSupported() || Notification.permission !== 'granted') return
    const now = new Date()
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    if (hhmm < s.time) return
    if (localStorage.getItem(SENT) === today()) return
    const p = pending()
    localStorage.setItem(SENT, today())
    if (p.count === 0) return
    const list = p.names.slice(0, 3).join(', ') + (p.names.length > 3 ? '…' : '')
    void show(p.count === 1 ? '1 task left today' : `${p.count} tasks left today`, list)
  }
  const id = window.setInterval(tick, 30000)
  const onVis = () => document.visibilityState === 'visible' && tick()
  document.addEventListener('visibilitychange', onVis)
  tick()
  return () => {
    window.clearInterval(id)
    document.removeEventListener('visibilitychange', onVis)
  }
}
