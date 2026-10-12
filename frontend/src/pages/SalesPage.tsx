import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { salesApi, errorMessage, SalesDay } from '../lib/api'
import { keys } from '../lib/queryKeys'

// Daily sales: one day's revenue, order count, average order and top items.
// Deliberately small — no charts, no comparisons, no export. A sale is a paid,
// uncancelled order, on the Asia/Manila day it was paid (backend sales.py).

// Whole pesos as ₱4,753; anything with centavos as ₱4,753.50, never ₱4,753.5.
const peso = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`

// Calendar arithmetic on YYYY-MM-DD strings, so the phone's own timezone
// can't shift the day. "Today" always comes from the server.
function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const longDate = (day: string) => new Date(`${day}T00:00:00Z`)
  .toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function Stat({ label, value, wide }: { label: string, value: string, wide?: boolean }) {
  return (
    <div className="panel" style={{
      gridColumn: wide ? '1 / -1' : undefined, padding: 16,
      ...(wide && { background: 'var(--accent-bg)', border: '1px solid var(--accent-lo)' }),
    }}>
      <span className="label">{label}</span>
      <div className="data" style={{ fontSize: wide ? 36 : 24, fontWeight: 700, color: wide ? 'var(--accent)' : 'var(--t1)', marginTop: 8, lineHeight: 1 }}>
        {value}
      </div>
    </div>
  )
}

export default function SalesPage() {
  // null = today, as the server reckons it in the café's timezone.
  const [date, setDate] = useState<string | null>(null)
  const { data, isLoading, isError, error, refetch } = useQuery<SalesDay>({
    queryKey: [...keys.sales, date ?? 'today'],
    queryFn: () => salesApi.getDay(date ?? undefined),
    placeholderData: prev => prev, // keep the last day on screen while the next loads
  })
  const today = data?.today
  const shown = date ?? today
  const isToday = !!shown && shown === today
  const go = (day: string) => setDate(today && day >= today ? null : day)

  return (
    <div className="page-enter" style={{ padding: '16px 16px 28px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <NavLink to="/dashboard" aria-label="Back to dashboard"
          style={{ color: 'var(--t2)', display: 'flex', padding: '10px 8px 10px 0' }}>
          <ChevronLeft size={18} aria-hidden="true" />
        </NavLink>
        <h1 className="display" style={{ fontSize: 40, color: 'var(--t1)', lineHeight: 0.95 }}>DAILY SALES</h1>
      </div>

      {/* Day: previous / native date picker / next. Never past today. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <button onClick={() => shown && go(addDays(shown, -1))} disabled={!shown}
          aria-label="Previous day" className="icon-btn">
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <label htmlFor="sales-date" style={{ display: 'none' }}>Day</label>
        <input id="sales-date" type="date" className="field data" style={{ flex: 1, textAlign: 'center' }}
          value={shown ?? ''} max={today}
          onChange={e => { if (e.target.value) go(e.target.value) }} />
        <button onClick={() => shown && go(addDays(shown, 1))} disabled={!shown || isToday}
          aria-label="Next day" className="icon-btn" style={{ opacity: !shown || isToday ? 0.35 : 1 }}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <p style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--t3)', letterSpacing: '0.06em', marginBottom: 16 }}>
        {shown ? `${longDate(shown).toUpperCase()}${isToday ? ' · TODAY' : ''}` : ' '}
      </p>

      {isError && !data && (
        <div className="panel" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <p role="alert" style={{ flex: 1, fontSize: 12, color: 'var(--danger)' }}>{errorMessage(error)}</p>
          <button onClick={() => refetch()} className="btn btn-ghost" style={{ minHeight: 'var(--touch)' }}>Retry</button>
        </div>
      )}

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="skeleton" style={{ gridColumn: '1 / -1', height: 88 }} />
          <div className="skeleton" style={{ height: 72 }} />
          <div className="skeleton" style={{ height: 72 }} />
          <div className="skeleton" style={{ gridColumn: '1 / -1', height: 180 }} />
        </div>
      ) : data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <Stat wide label="Revenue" value={peso(data.revenue)} />
            <Stat label="Orders" value={String(data.order_count)} />
            <Stat label="Average order" value={peso(data.average_order_value)} />
          </div>

          <div className="panel">
            <p className="label" style={{ padding: '14px 16px 10px' }}>Top items</p>
            {data.top_items.length ? data.top_items.map((t, i) => (
              <div key={`${t.name}|${t.category}`} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                borderTop: '1px solid var(--border)',
              }}>
                <span className="data" style={{ fontSize: 12, color: 'var(--t3)', width: 14 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{t.name}</p>
                  {t.category && <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{t.category}</p>}
                </div>
                <span className="data" style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>&times;{t.quantity}</span>
              </div>
            )) : (
              <p role="status" style={{ padding: '6px 16px 16px', fontSize: 12, color: 'var(--t3)' }}>
                No paid orders on this day.
              </p>
            )}
          </div>

          <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 12 }}>
            Paid orders only, on the day they were paid. Cancelled orders don't count.
          </p>
        </>
      )}
    </div>
  )
}
