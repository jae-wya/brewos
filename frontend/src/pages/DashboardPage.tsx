import { useQuery } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { queueApi } from '../lib/api'
import { useWakeState } from '../hooks/useWakeState'
import { keys } from '../lib/queryKeys'
import { peso } from '../lib/composer'

// The first screen she sees on every open: the stall's sign for the day,
// hand-lettered on one lit plate — the kind of board a stall hangs out
// front — rather than a grid of stat tiles. Each line is a short sentence;
// the figures lead by size, in the text colour. The two lines that lead
// somewhere are links: takings to Daily sales, the rail to the Queue (the
// same "rail" the chits hang on).

function SignLine({ figure, words, color, to, label }: {
  figure: string, words: string, color: string, to?: string, label?: string
}) {
  const body = (
    <>
      <span className="display" style={{ fontSize: 48, color, lineHeight: 0.9 }}>{figure}</span>
      <span className="display" style={{ fontSize: 26, color: 'var(--t1)', lineHeight: 1, marginLeft: 10, letterSpacing: '0.03em' }}>{words}</span>
      {to && <ChevronRight size={20} aria-hidden="true" style={{ marginLeft: 'auto', color: 'var(--t2)', flexShrink: 0 }} />}
    </>
  )
  const style = {
    display: 'flex', alignItems: 'baseline', minHeight: 64, padding: '12px 0',
    borderTop: '1px solid var(--border)', textDecoration: 'none',
  } as const
  return to
    ? <NavLink to={to} aria-label={label} style={{ ...style, alignItems: 'center' }}>{body}</NavLink>
    : <p style={style}>{body}</p>
}

export default function DashboardPage() {
  const waking = useWakeState()
  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: keys.stats,
    queryFn: queueApi.getStats,
    refetchInterval: 30_000,
    retry: 2,
  })
  // Shown at their value, no count-up: she opens this dozens of times a day,
  // and a count-up flashed "₱0 taken" every time.
  const orders = stats?.total_orders ?? 0
  const onRail = stats?.active_orders ?? 0

  // The café's timezone (from the backend), so the day named on the sign is
  // the day the stats were counted for. The phone's zone until loaded.
  const timeZone: string | undefined = stats?.timezone
  const now = new Date()
  const hour = Number(now.toLocaleString('en-PH', { hour: 'numeric', hourCycle: 'h23', timeZone }))
  const shift = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'
  const day = now.toLocaleDateString('en-PH', { weekday: 'long', timeZone })
  const date = now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone })
  const takings = peso(Number(stats?.total_revenue ?? 0))

  return (
    <div className="page-enter" style={{ padding: '20px 16px 28px', maxWidth: 480, margin: '0 auto' }}>

      {waking && (
        <div className="wake-banner" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', marginBottom: 16,
          background: 'var(--s2)', border: '1px solid var(--border-hi)',
          borderRadius: 'var(--r)',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--t2)', animation: 'pulse 1s infinite' }} />
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--t2)', letterSpacing: '0.06em' }}>
            WAKING SERVER UP···
          </span>
        </div>
      )}

      {isError && (
        <div style={{ padding: '12px 16px', marginBottom: 16, background: 'color-mix(in srgb, var(--danger) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)', borderRadius: 'var(--r)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--danger)' }}>COULDN'T REACH SERVER</span>
          <button onClick={() => refetch()} className="btn btn-danger" style={{ fontSize: 12 }}>Retry</button>
        </div>
      )}

      {/* The sign */}
      <section className="panel" aria-label="Today so far" style={{ padding: '18px 18px 6px', marginBottom: 20 }}>
        <p className="data" style={{ fontSize: 11, color: 'var(--t2)', letterSpacing: '0.1em' }}>
          {date.toUpperCase()}
        </p>
        <h1 className="display" style={{ fontSize: 40, color: 'var(--t1)', lineHeight: 1, margin: '4px 0 12px', letterSpacing: '0.02em' }}>
          {day} · {shift}
        </h1>
        {isLoading ? (
          [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 12 }} />)
        ) : (
          <>
            <SignLine figure={String(orders)} words={orders === 1 ? 'order' : 'orders'} color="var(--t1)" />
            <SignLine figure={takings} words="taken" color="var(--t1)" to="/sales"
              label={`${takings} taken today — open daily sales`} />
            <SignLine figure={String(onRail)} words="on the rail" color="var(--t1)" to="/queue"
              label={`${onRail} ${onRail === 1 ? 'order' : 'orders'} on the rail — open the queue`} />
            <p className="data" style={{ fontSize: 12, color: 'var(--t2)', padding: '10px 0 12px', borderTop: '1px solid var(--border)' }}>
              {stats?.completed_orders ?? 0} done · {stats?.cancelled_orders ?? 0} cancelled
            </p>
          </>
        )}
      </section>

      <NavLink to="/orders/new" className="btn btn-fire"
        style={{ width: '100%', minHeight: 56, fontSize: 16 }}>
        Take an order
      </NavLink>
    </div>
  )
}
