import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Coffee, ListOrdered, UtensilsCrossed, Plus, Sun, Moon } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import clsx from 'clsx'

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/queue',     icon: Coffee,          label: 'Queue'     },
  { to: '/orders',    icon: ListOrdered,     label: 'Orders'    },
  { to: '/menu',      icon: UtensilsCrossed, label: 'Menu'      },
]

export default function Layout() {
  const { theme, toggle } = useTheme()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Top bar */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }} className="px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div style={{ background: 'var(--accent)', borderRadius: 10 }}
            className="w-9 h-9 flex items-center justify-center shadow-sm">
            <Coffee size={17} color="#0F0A06" />
          </div>
          <div>
            <p className="font-display font-bold leading-none text-sm" style={{ color: 'var(--text)' }}>
              BrewOS
            </p>
            <p className="text-xs leading-none mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Glimpse of Del
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            style={{ color: 'var(--text-muted)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <NavLink
            to="/orders/new"
            className="btn btn-primary text-xs px-3 py-2"
          >
            <Plus size={14} /> New Order
          </NavLink>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
        className="flex sticky bottom-0 z-50">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => clsx(
              'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
            )}
            style={({ isActive }) => ({
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
            })}
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
