import { useQuery } from '@tanstack/react-query'
import { queueApi } from '../lib/api'
import { Coffee, ShoppingBag, CheckCircle, TrendingUp } from 'lucide-react'
import { NavLink } from 'react-router-dom'

export default function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: queueApi.getStats,
    refetchInterval: 30_000,
  })

  const cards = [
    {
      label: 'Active Orders',
      value: stats?.active_orders ?? '—',
      icon: Coffee,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Total Today',
      value: stats?.total_orders ?? '—',
      icon: ShoppingBag,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Completed',
      value: stats?.completed_orders ?? '—',
      icon: CheckCircle,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      label: "Today's Revenue",
      value: stats ? `₱${stats.total_revenue.toLocaleString()}` : '—',
      icon: TrendingUp,
      color: 'text-brew-400',
      bg: 'bg-brew-500/10',
    },
  ]

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-6 mt-2">
        <h1 className="font-display text-2xl font-bold text-brew-100">
          Good day ☕
        </h1>
        <p className="text-roast-400 text-sm mt-1">
          {new Date().toLocaleDateString('en-PH', {
            weekday: 'long', month: 'long', day: 'numeric'
          })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-4">
            <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <p className="text-2xl font-bold text-brew-100">{value}</p>
            <p className="text-roast-400 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="card p-4 mb-4">
        <p className="text-roast-400 text-xs font-semibold uppercase tracking-wider mb-3">
          Quick Actions
        </p>
        <div className="flex flex-col gap-2">
          <NavLink to="/orders/new" className="btn-primary text-center text-sm">
            + New Walk-in Order
          </NavLink>
          <NavLink to="/queue" className="btn-secondary text-center text-sm">
            View Live Queue
          </NavLink>
        </div>
      </div>

      {/* Demo badge */}
      <div className="text-center">
        <span className="text-xs text-roast-500 bg-roast-800 border border-roast-700 px-3 py-1 rounded-full">
          🎭 Demo Mode — Glimpse of Del
        </span>
      </div>
    </div>
  )
}
