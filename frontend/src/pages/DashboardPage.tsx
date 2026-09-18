import { useQuery } from '@tanstack/react-query'
import { queueApi } from '../lib/api'
import { Coffee, ShoppingBag, CheckCircle, TrendingUp, ArrowRight } from 'lucide-react'
import { NavLink } from 'react-router-dom'

export default function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: queueApi.getStats,
    refetchInterval: 30_000,
  })

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const cards = [
    { label: 'Active orders',   value: stats?.active_orders    ?? '—', icon: Coffee,       color: 'var(--pending)' },
    { label: 'Total today',     value: stats?.total_orders      ?? '—', icon: ShoppingBag,  color: 'var(--brewing)' },
    { label: 'Completed',       value: stats?.completed_orders  ?? '—', icon: CheckCircle,  color: 'var(--ready)'   },
    { label: "Today's revenue", value: stats ? `₱${Number(stats.total_revenue).toLocaleString()}` : '—', icon: TrendingUp, color: 'var(--accent)' },
  ]

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Greeting */}
      <div className="mt-4 mb-6">
        <h1 className="font-display text-3xl" style={{ color: 'var(--text)' }}>
          {greeting} ☕
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <Icon size={16} style={{ color }} />
              <span className="font-mono text-2xl font-bold" style={{ color: 'var(--text)' }}>
                {value}
              </span>
            </div>
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="card p-4 mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-faint)' }}>
          Quick actions
        </p>
        <div className="flex flex-col gap-2">
          <NavLink to="/orders/new" className="btn btn-primary w-full justify-between">
            <span>New walk-in order</span>
            <ArrowRight size={15} />
          </NavLink>
          <NavLink to="/queue" className="btn btn-ghost w-full justify-between">
            <span>View live queue</span>
            <ArrowRight size={15} />
          </NavLink>
        </div>
      </div>

      {/* Demo badge */}
      <div className="text-center">
        <span className="text-xs px-3 py-1.5 rounded-full"
          style={{ color: 'var(--text-faint)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          🎭 Demo — Glimpse of Del
        </span>
      </div>
    </div>
  )
}
