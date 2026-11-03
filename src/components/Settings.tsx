import { useState } from 'react'
import { askPermission, getReminders, notificationsSupported, saveReminders } from '../lib/reminders'

export default function Settings({ onClose, email, onSignOut }: { onClose: () => void; email?: string; onSignOut?: () => void }) {
  const [s, setS] = useState(getReminders())
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(notificationsSupported() ? Notification.permission : 'unsupported')

  async function toggle(on: boolean) {
    if (on) {
      const p = await askPermission()
      setPerm(p)
      if (p !== 'granted') return
    }
    const n = { ...s, enabled: on }
    setS(n)
    saveReminders(n)
  }

  function setTime(time: string) {
    const n = { ...s, time }
    setS(n)
    saveReminders(n)
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <div className="row between">
          <h2>Settings</h2>
          <button className="icon" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="card">
          <div className="card-title">Daily reminder</div>
          {perm === 'unsupported' ? (
            <p className="muted small">This browser doesn't support notifications.</p>
          ) : (
            <>
              <label className="row between">
                <span>Remind me if tasks are still undone</span>
                <input type="checkbox" className="switch" checked={s.enabled} onChange={(e) => toggle(e.target.checked)} />
              </label>
              <div className="row between">
                <span className="muted">At</span>
                <input className="input" style={{ width: 130 }} type="time" value={s.time} onChange={(e) => setTime(e.target.value)} disabled={!s.enabled} />
              </div>
              {perm === 'denied' && <p className="notice">Notifications are blocked. Allow them for this site in your browser settings, then switch this on again.</p>}
              <p className="muted small">
                Reminders arrive while Streakboard is open or running in the background. Phones and browsers don't wake a fully closed web app, so if it's been closed for hours the reminder may show when you next open it.
              </p>
            </>
          )}
        </div>

        {email && <div className="muted small">Signed in as {email}</div>}
        {onSignOut && <button className="btn danger" onClick={onSignOut}>Sign out</button>}
      </div>
    </div>
  )
}
