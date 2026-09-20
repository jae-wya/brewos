import { useQuery } from '@tanstack/react-query'
import { queueApi } from '../lib/api'
import { useWakeState } from '../hooks/useWakeState'
import { useCountUp } from '../hooks/useCountUp'
import { NavLink } from 'react-router-dom'

function StatCard({ label, value, color, delay = 0 }: {
  label: string, value: number, color: string, delay?: number
}) {
  const animated = useCountUp(value, 900)
  return (
    <div className="panel page-enter-child" style={{
      padding: '16px',
      animationDelay: `${delay}ms`,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <span className="label">{label}</span>
      <span className="data" style={{ fontSize: 36, fontWeight: 700, color, lineHeight: 1 }}>
        {animated}
      </span>
    </div>
  )
}

export default function DashboardPage() {
  const waking = useWakeState()
  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: ['stats'],
    queryFn: queueApi.getStats,
    refetchInterval: 30_000,
    retry: 2,
  })

  const hour = new Date().getHours()
  const shift = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'
  const date = new Date().toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className="page-enter" style={{ padding: '20px 16px 28px', maxWidth: 480, margin: '0 auto' }}>

      {/* Wake banner */}
      {waking && (
        <div className="wake-banner" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', marginBottom: 16,
          background: 'var(--accent-bg)', border: '1px solid var(--accent-lo)',
          borderRadius: 'var(--r)',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s infinite' }} />
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--accent)', letterSpacing: '0.06em' }}>
            WAKING SERVER UP···
          </span>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: 'var(--t3)', letterSpacing: '0.12em', marginBottom: 8 }}>
          {date.toUpperCase()} · {shift.toUpperCase()} SHIFT
        </p>
        <h1 className="display" style={{ fontSize: 52, color: 'var(--t1)' }}>
          TODAY'S<br />OVERVIEW
        </h1>
      </div>

      {/* Error */}
      {isError && (
        <div style={{ padding: '12px 16px', marginBottom: 16, background: 'rgba(255,75,75,0.08)', border: '1px solid rgba(255,75,75,0.2)', borderRadius: 'var(--r)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--danger)' }}>COULDN'T REACH SERVER</span>
          <button onClick={() => refetch()} className="btn btn-danger" style={{ padding: '6px 14px', fontSize: 11 }}>Retry</button>
        </div>
      )}

      {/* Stats grid */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 88 }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <StatCard label="Active now"    value={stats?.active_orders    ?? 0} color="var(--pending)" delay={0}   />
          <StatCard label="Orders today"  value={stats?.total_orders      ?? 0} color="var(--t1)"     delay={80}  />
          <StatCard label="Completed"     value={stats?.completed_orders  ?? 0} color="var(--ready)"  delay={160} />
          {/* Revenue spans full width */}
          <div className="panel page-enter-child" style={{ gridColumn: '1 / -1', padding: '16px', animationDelay: '240ms', background: 'var(--accent-bg)', border: '1px solid var(--accent-lo)' }}>
            <span className="label" style={{ color: 'var(--accent-lo)' }}>Revenue today</span>
            <div className="data" style={{ fontSize: 36, fontWeight: 700, color: 'var(--accent)', marginTop: 8, lineHeight: 1 }}>
              ₱{Number(stats?.total_revenue ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* CTAs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <NavLink to="/orders/new" className="btn btn-fire page-enter-child"
          style={{ width: '100%', padding: '16px', fontSize: 15, animationDelay: '300ms' }}>
          Take an order
        </NavLink>
        <NavLink to="/queue" className="btn btn-ghost page-enter-child"
          style={{ width: '100%', padding: '16px', fontSize: 15, animationDelay: '360ms' }}>
          View queue
        </NavLink>
      </div>
    </div>
  )
}
