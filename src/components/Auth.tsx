import { useState } from 'react'
import { supabase } from '../lib/repo'

export default function Auth() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMsg(null)
    const { data, error } =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
    setBusy(false)
    if (error) setMsg(error.message)
    else if (mode === 'up' && !data.session) setMsg('Account created. Check your email to confirm it, then sign in.')
  }

  async function google() {
    if (!supabase) return
    setMsg(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) setMsg(/not enabled|unsupported/i.test(error.message) ? 'Google sign-in isn\'t switched on for this app yet. Use email for now.' : error.message)
  }

  async function reset() {
    if (!supabase || !email) return setMsg('Type your email first, then tap "Forgot password".')
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    setMsg(error ? error.message : 'Password reset email sent.')
  }

  return (
    <div className="auth">
      <h1>Streakboard</h1>
      <p className="muted">See your consistency. See where you're heading.</p>
      <form onSubmit={submit} className="card stack">
        <button type="button" className="btn google" onClick={google}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
          Continue with Google
        </button>
        <div className="divider"><span>or</span></div>
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <input className="input" type="password" placeholder="Password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
        <button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
        {msg && <p className="notice">{msg}</p>}
        <div className="row between">
          <button type="button" className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
            {mode === 'in' ? 'New here? Create account' : 'Have an account? Sign in'}
          </button>
          {mode === 'in' && <button type="button" className="link" onClick={reset}>Forgot password</button>}
        </div>
      </form>
    </div>
  )
}
