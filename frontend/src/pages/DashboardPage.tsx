import { useQuery } from '@tanstack/react-query'
import { queueApi } from '../lib/api'
import { useWakeState } from '../hooks/useWakeState'
import { NavLink } from 'react-router-dom'

function StatRow({ label, value, color, isLoading }: {
  label: string, value: string | number, color: string, isLoading: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '13px 16px',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--t2)', letterSpacing: '0.04em' }}>
        {label}
      </span>
      {isLoading ? (
        <div className="skeleton" style={{ width: 40, height: 24 }} />
      ) : (
        <span className="type-data" style={{ fontSize: 22, fontWeight: 700, color }}>
          {value}
        </span>
      )}
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
  const shift = hour < 12 ? 'Morning shift' : hour < 17 ? 'Afternoon shift' : 'Evening shift'
  const date = new Date().toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div style={{ padding: '20px 16px 24px', maxWidth: 480, margin: '0 auto' }}>

      {/* Wake notice */}
      {waking && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', marginBottom: 16,
          background: 'var(--accent-bg)', border: '1px solid var(--accent-lo)',
          borderRadius: 'var(--r)',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
            animation: 'pulse 1s infinite',
          }} />
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--accent)', letterSpacing: '0.06em' }}>
            WAKING SERVER UP···
          </span>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--t3)', letterSpacing: '0.08em', marginBottom: 6 }}>
          {date.toUpperCase()} · {shift.toUpperCase()}
        </p>
        <h1 className="type-display" style={{ fontSize: 28, color: 'var(--t1)', lineHeight: 1.1 }}>
          Today's overview
        </h1>
      </div>

      {/* Error state */}
      {isError && !isLoading && (
        <div style={{
          padding: '16px', marginBottom: 16,
          background: 'rgba(255,75,75,0.08)', border: '1px solid rgba(255,75,75,0.2)',
          borderRadius: 'var(--r)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--danger)', letterSpacing: '0.05em' }}>
            COULDN'T REACH SERVER
          </span>
          <button onClick={() => refetch()} className="btn btn-danger" style={{ padding: '5px 12px', fontSize: 10 }}>
            Retry
          </button>
        </div>
      )}

      {/* Stats — receipt list */}
      <div className="panel" style={{ marginBottom: 12 }}>
        <StatRow label="Active now"    value={stats?.active_orders   ?? 0} color="var(--pending)" isLoading={isLoading} />
        <StatRow label="Orders today"  value={stats?.total_orders     ?? 0} color="var(--t1)"     isLoading={isLoading} />
        <StatRow label="Completed"     value={stats?.completed_orders ?? 0} color="var(--ready)"  isLoading={isLoading} />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '13px 16px',
          background: 'var(--accent-bg)',
          borderTop: '1px solid var(--accent-lo)',
          borderRadius: '0 0 3px 3px',
        }}>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--accent-lo)', letterSpacing: '0.04em' }}>
            Revenue today
          </span>
          {isLoading ? (
            <div className="skeleton" style={{ width: 60, height: 24 }} />
          ) : (
            <span className="type-data" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
              ₱{Number(stats?.total_revenue ?? 0).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* CTAs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <NavLink to="/orders/new" className="btn btn-accent"
          style={{ width: '100%', padding: '14px', fontSize: 14 }}>
          Take an order
        </NavLink>
        <NavLink to="/queue" className="btn btn-outline"
          style={{ width: '100%', padding: '14px', fontSize: 14 }}>
          View queue
        </NavLink>
      </div>
    </div>
  )
}
