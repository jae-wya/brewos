import { useQuery } from '@tanstack/react-query'
import { queueApi } from '../lib/api'
import { NavLink } from 'react-router-dom'
import { ArrowRight, Zap } from 'lucide-react'

export default function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: queueApi.getStats,
    refetchInterval: 30_000,
  })

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const date = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>

      {/* Hero greeting */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 6 }}>
          {date}
        </p>
        <h1 className="font-display" style={{ fontSize: 36, color: 'var(--text)', lineHeight: 1.1 }}>
          {greeting}.
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
          Here's what's happening at Glimpse of Del today.
        </p>
      </div>

      {/* Stats — 2x2 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Active orders',    value: stats?.active_orders    ?? '—', accent: 'var(--pending)' },
          { label: 'Total today',      value: stats?.total_orders      ?? '—', accent: 'var(--brewing)' },
          { label: 'Completed',        value: stats?.completed_orders  ?? '—', accent: 'var(--ready)'   },
          { label: "Today's revenue",  value: stats ? `₱${Number(stats.total_revenue).toLocaleString()}` : '—', accent: 'var(--accent)' },
        ].map(({ label, value, accent }) => (
          <div key={label} className="card" style={{ padding: '16px' }}>
            <div className="font-mono" style={{ fontSize: 28, fontWeight: 700, color: accent, lineHeight: 1, marginBottom: 8 }}>
              {value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <p className="section-label" style={{ marginBottom: 12 }}>Quick actions</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <NavLink to="/orders/new" className="btn btn-primary" style={{ width: '100%', justifyContent: 'space-between', padding: '12px 18px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={14} /> New walk-in order
            </span>
            <ArrowRight size={14} />
          </NavLink>
          <NavLink to="/queue" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'space-between', padding: '12px 18px' }}>
            <span>View live queue</span>
            <ArrowRight size={14} />
          </NavLink>
        </div>
      </div>

      {/* Demo tag */}
      <div style={{ textAlign: 'center' }}>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
          color: 'var(--text-faint)', textTransform: 'uppercase',
          background: 'var(--surface)', border: '1px solid var(--border)',
          padding: '5px 12px', borderRadius: 999,
        }}>
          🎭 Demo Mode
        </span>
      </div>
    </div>
  )
}
