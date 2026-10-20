import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { NavLink, useNavigate } from 'react-router-dom'
import { ChevronLeft, LogOut } from 'lucide-react'
import { settingsApi, authApi, errorMessage } from '../lib/api'
import { newPasswordProblem, PASSWORD_MIN } from '../lib/password'
import { keys } from '../lib/queryKeys'
import { clearSession } from '../lib/session'
import { fillTemplate, unknownPlaceholders, PLACEHOLDERS } from '../lib/composer'

// Her settings: the Messenger payment request she copies from the cart, and
// the GCash / Maya numbers it fills in. She edits these herself.

const HELP: Record<typeof PLACEHOLDERS[number], string> = {
  items: 'the items, one per line',
  total: 'the total',
  pickup: 'pickup time',
  name: "customer's name",
  gcash: 'your GCash number',
  maya: 'your Maya number',
}

// What the preview fills in, so she sees a realistic message while editing.
const SAMPLE = {
  lines: [{ quantity: 1, name: 'Spanish Latte', category: 'Iced Coffee', showCategory: true, modifiers: ['Medium (M)'], lineTotal: 120 }],
  total: 120, pickup: 'in an hour or two', name: 'Ana',
}

// Her own password. Jae gives her a temporary one at handover and she
// changes it here, so he never knows the real one.
function PasswordSection() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [status, setStatus] = useState<{ saving?: boolean, changed?: boolean, error?: string }>({})

  const edit = (set: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => { set(e.target.value); setStatus({}) }

  const change = async () => {
    const problem = newPasswordProblem(current, next, again)
    if (problem) return setStatus({ error: problem })
    setStatus({ saving: true })
    try {
      await authApi.changePassword(current, next)
      setCurrent(''); setNext(''); setAgain('')
      setStatus({ changed: true })
    } catch (err) {
      setStatus({ error: errorMessage(err) })
    }
  }

  return (
    <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
      <h2 className="display" style={{ fontSize: 24, color: 'var(--t1)', marginBottom: 12 }}>PASSWORD</h2>
      <label htmlFor="pw-current" className="label" style={{ display: 'block', marginBottom: 8 }}>Current password</label>
      <input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={edit(setCurrent)}
        className="field" style={{ marginBottom: 14 }} />
      <label htmlFor="pw-new" className="label" style={{ display: 'block', marginBottom: 8 }}>New password</label>
      <input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={edit(setNext)}
        aria-describedby="pw-hint" className="field" style={{ marginBottom: 6 }} />
      <p id="pw-hint" style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 14 }}>At least {PASSWORD_MIN} characters.</p>
      <label htmlFor="pw-again" className="label" style={{ display: 'block', marginBottom: 8 }}>New password again</label>
      <input id="pw-again" type="password" autoComplete="new-password" value={again} onChange={edit(setAgain)}
        enterKeyHint="done" onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); change() } }}
        className="field" style={{ marginBottom: 14 }} />
      {status.error && <p role="alert" style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>{status.error}</p>}
      {status.changed && (
        <p role="status" style={{ fontSize: 12, color: 'var(--t1)', marginBottom: 10 }}>
          Password changed. Use the new one next time you log in.
        </p>
      )}
      <button onClick={change} disabled={status.saving || !current || !next || !again}
        className="btn btn-ghost" style={{ width: '100%', minHeight: 'var(--touch)', fontSize: 14 }}>
        {status.saving ? 'Changing…' : 'Change password'}
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const qc = useQueryClient()
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: keys.settings, queryFn: settingsApi.get })
  const [template, setTemplate] = useState('')
  const [gcash, setGcash] = useState('')
  const [maya, setMaya] = useState('')
  const [status, setStatus] = useState<{ saving?: boolean, saved?: boolean, error?: string }>({})
  const box = useRef<HTMLTextAreaElement>(null)
  const navigate = useNavigate()

  // Moved here from the header: rare and destructive, so out of mis-tap range
  // mid-shift, and well away from Save.
  const logOut = () => {
    clearSession()
    qc.clear()
    navigate('/login', { replace: true })
  }

  // Load once into the form; later refetches don't overwrite her typing.
  const loaded = useRef(false)
  useEffect(() => {
    if (data && !loaded.current) {
      loaded.current = true
      setTemplate(data.messenger_template); setGcash(data.gcash_number); setMaya(data.maya_number)
    }
  }, [data])

  const dirty = !!data && (template !== data.messenger_template || gcash !== data.gcash_number || maya !== data.maya_number)
  const unknown = unknownPlaceholders(template)

  // Braces are buried on a phone keyboard: tapping a chip inserts at the cursor.
  const insert = (p: string) => {
    const el = box.current
    const at = el ? el.selectionStart : template.length
    const end = el ? el.selectionEnd : template.length
    const next = `${template.slice(0, at)}{${p}}${template.slice(end)}`
    setTemplate(next); setStatus({})
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + p.length + 2, at + p.length + 2) })
  }

  const save = async () => {
    if (!data) return
    setStatus({ saving: true })
    try {
      const saved = await settingsApi.update({
        // Saving the default text exactly keeps her on the default.
        messenger_template: template.trim() === data.default_template.trim() ? null : template,
        gcash_number: gcash, maya_number: maya,
      })
      qc.setQueryData(keys.settings, saved)
      setTemplate(saved.messenger_template); setGcash(saved.gcash_number); setMaya(saved.maya_number)
      setStatus({ saved: true })
    } catch (err) {
      setStatus({ error: errorMessage(err) })
    }
  }

  return (
    <div className="page-enter" style={{ padding: '16px 16px 28px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <NavLink to="/dashboard" aria-label="Back to dashboard"
          style={{ color: 'var(--t2)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, marginLeft: -12, flexShrink: 0 }}>
          <ChevronLeft size={18} aria-hidden="true" />
        </NavLink>
        <h1 className="display" style={{ fontSize: 40, color: 'var(--t1)', lineHeight: 0.95 }}>SETTINGS</h1>
      </div>

      {isLoading && <div className="skeleton" style={{ height: 320 }} />}
      {isError && !data && (
        <div className="panel" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <p role="alert" style={{ flex: 1, fontSize: 12, color: 'var(--danger)' }}>{errorMessage(error)}</p>
          <button onClick={() => refetch()} className="btn btn-ghost" style={{ minHeight: 'var(--touch)' }}>Retry</button>
        </div>
      )}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            <div>
              <label htmlFor="gcash" className="label" style={{ display: 'block', marginBottom: 8 }}>GCash number</label>
              <input id="gcash" type="tel" inputMode="tel" value={gcash} autoComplete="off" placeholder="0917 123 4567"
                onChange={e => { setGcash(e.target.value); setStatus({}) }} className="field data" />
            </div>
            <div>
              <label htmlFor="maya" className="label" style={{ display: 'block', marginBottom: 8 }}>Maya number</label>
              <input id="maya" type="tel" inputMode="tel" value={maya} autoComplete="off" placeholder="0917 123 4567"
                onChange={e => { setMaya(e.target.value); setStatus({}) }} className="field data" />
            </div>
          </div>

          <label htmlFor="template" className="label" style={{ display: 'block', marginBottom: 6 }}>Payment message</label>
          <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 10 }}>
            What "Copy payment message" puts on the clipboard. Tap a tag to add it where the cursor is.
            A line whose tag has nothing to fill it, like no pickup time, is left out — except {'{name}'}, which just disappears.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {PLACEHOLDERS.map(p => (
              <button key={p} onClick={() => insert(p)} className="chip" aria-label={`Insert ${HELP[p]}`}>
                <span className="data" style={{ fontSize: 11 }}>{`{${p}}`}</span>
              </button>
            ))}
          </div>
          <textarea id="template" ref={box} value={template} rows={12} className="field"
            onChange={e => { setTemplate(e.target.value); setStatus({}) }}
            style={{ fontSize: 13, lineHeight: 1.5, resize: 'vertical' }} />
          {unknown.length > 0 && (
            <p role="alert" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 6 }}>
              {unknown.map(u => `{${u}}`).join(', ')} isn't a tag BrewOS knows, so it will be sent as written.
            </p>
          )}
          <button onClick={() => { setTemplate(data.default_template); setStatus({}) }}
            disabled={template === data.default_template}
            style={{ marginTop: 6, minHeight: 'var(--touch)', padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--t1)', opacity: template === data.default_template ? 0.4 : 1 }}>
            Reset to the default message
          </button>

          <p className="label" style={{ margin: '16px 0 8px' }}>Preview</p>
          <div className="panel" style={{ padding: 14, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5, color: 'var(--t1)' }}>
            {fillTemplate(template, { ...SAMPLE, gcash, maya }) || <span style={{ color: 'var(--t2)' }}>(empty)</span>}
          </div>

          <div style={{ marginTop: 18 }}>
            {status.error && <p role="alert" style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>{status.error}</p>}
            <button onClick={save} disabled={!dirty || status.saving}
              className="btn btn-fire" style={{ width: '100%', padding: 16, fontSize: 15 }}>
              {status.saving ? 'Saving…' : status.saved && !dirty ? 'Saved' : 'Save'}
            </button>
          </div>
        </>
      )}

      {/* Shown even if settings fail to load: it doesn't depend on them. */}
      <PasswordSection />

      {/* Shown even if settings fail to load: logging out must always work. */}
      <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <button onClick={logOut}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, minHeight: 'var(--touch)', padding: '0 4px',
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--danger)',
          }}>
          <LogOut size={14} aria-hidden="true" />
          Log out of this phone
        </button>
      </div>
    </div>
  )
}
