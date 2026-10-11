import { useState, FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Coffee } from 'lucide-react'
import { authApi, errorMessage } from '../lib/api'
import { getSession, saveSession } from '../lib/session'
import { useWakeState } from '../hooks/useWakeState'

// Only return to a path inside this app — never an absolute or //host URL.
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login')
    ? next : '/dashboard'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const waking = useWakeState()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (getSession()) return <Navigate to={next} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await authApi.ownerLogin(email.trim(), password)
      saveSession({ access_token: res.access_token, display_name: res.display_name })
      navigate(next, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form onSubmit={submit} className="page-enter" style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--accent-a), var(--accent-b))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Coffee size={20} color="#14100C" strokeWidth={2.5} aria-hidden="true" />
          </div>
          <div>
            <h1 className="display" style={{ fontSize: 36, color: 'var(--t1)', lineHeight: 1 }}>BREWOS</h1>
            <p className="label" style={{ marginTop: 2 }}>Glimpse of Del</p>
          </div>
        </div>

        {waking && (
          <div className="wake-banner" role="status" style={{
            padding: '10px 14px', marginBottom: 16,
            background: 'var(--accent-bg)', border: '1px solid var(--accent-lo)', borderRadius: 'var(--r)',
          }}>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--accent)', letterSpacing: '0.06em' }}>
              WAKING SERVER UP··· THIS CAN TAKE 30 SECONDS
            </span>
          </div>
        )}

        {error && (
          <div role="alert" style={{
            padding: '12px 16px', marginBottom: 16,
            background: 'rgba(255,75,75,0.08)', border: '1px solid rgba(255,75,75,0.2)', borderRadius: 'var(--r)',
            fontSize: 13, color: 'var(--danger)',
          }}>
            {error}
          </div>
        )}

        <label htmlFor="email" className="label" style={{ display: 'block', marginBottom: 8 }}>Email</label>
        <input id="email" type="email" className="field" required
          autoComplete="username" inputMode="email" autoCapitalize="none"
          value={email} onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', marginBottom: 16 }} />

        <label htmlFor="password" className="label" style={{ display: 'block', marginBottom: 8 }}>Password</label>
        <input id="password" type="password" className="field" required
          autoComplete="current-password"
          value={password} onChange={e => setPassword(e.target.value)}
          style={{ width: '100%', marginBottom: 24 }} />

        <button type="submit" disabled={busy || !email || !password} className="btn btn-fire"
          style={{ width: '100%', padding: 16, fontSize: 15 }}>
          {busy ? 'Logging in···' : 'Log in'}
        </button>
      </form>
    </div>
  )
}
