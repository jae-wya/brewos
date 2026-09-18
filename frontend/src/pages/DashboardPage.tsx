import { useQuery } from '@tanstack/react-query'
import { queueApi } from '../lib/api'
import { NavLink } from 'react-router-dom'

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: queueApi.getStats,
    refetchInterval: 30_000,
  })

  const hour = new Date().getHours()
  const shift = hour < 12 ? 'Morning shift' : hour < 17 ? 'Afternoon shift' : 'Evening shift'
  const date = new Date().toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div style={{ padding: '20px 16px 0', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--t3)', letterSpacing: '0.08em', marginBottom: 4 }}>
            {date.toUpperCase()} · {shift.toUpperCase()}
          </p>
          <h1 className="type-display" style={{ fontSize: 28, color: 'var(--t1)', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
                  Today's overview
            </h1>
        </div>
        
      </div>

      {/* Stats — receipt-style list, not cards */}
      <div className="panel" style={{ marginBottom: 12 }}>
        {[
          { label: 'Active now',      value: stats?.active_orders    ?? (isLoading ? '···' : '0'), color: 'var(--pending)' },
          { label: 'Orders today',    value: stats?.total_orders      ?? (isLoading ? '···' : '0'), color: 'var(--t1)'     },
          { label: 'Completed',       value: stats?.completed_orders  ?? (isLoading ? '···' : '0'), color: 'var(--ready)'  },
        ].map(({ label, value, color }, i, arr) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--t2)', letterSpacing: '0.04em' }}>
              {label}
            </span>
            <span className="type-data" style={{ fontSize: 22, fontWeight: 700, color }}>
              {value}
            </span>
          </div>
        ))}
        {/* Revenue row — full width accent */}
        <div style={{
          padding: '14px 16px',
          background: 'var(--accent-bg)',
          borderTop: '1px solid var(--accent-lo)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderRadius: '0 0 3px 3px',
        }}>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--accent-lo)', letterSpacing: '0.04em' }}>
            Revenue today
          </span>
          <span className="type-data" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
            {stats ? `₱${Number(stats.total_revenue).toLocaleString()}` : (isLoading ? '···' : '₱0')}
          </span>
        </div>
      </div>

      {/* CTAs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24 }}>
        <NavLink to="/orders/new" className="btn btn-accent"
          style={{ width: '100%', padding: '13px', fontSize: 13 }}>
          Take an order
        </NavLink>
        <NavLink to="/queue" className="btn btn-outline"
          style={{ width: '100%', padding: '13px', fontSize: 13 }}>
          View queue
        </NavLink>
      </div>
    </div>
  )
}
