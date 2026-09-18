import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Coffee, ListOrdered, UtensilsCrossed, Plus, Sun, Moon } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/queue',     icon: Coffee,          label: 'Queue'     },
  { to: '/orders',    icon: ListOrdered,     label: 'Orders'    },
  { to: '/menu',      icon: UtensilsCrossed, label: 'Menu'      },
]

export default function Layout() {
  const { theme, toggle } = useTheme()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* Top bar */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34,
            background: 'var(--accent)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Coffee size={16} color="#080503" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 15, fontWeight: 400, color: 'var(--text)', lineHeight: 1 }}>
              BrewOS
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1, marginTop: 3, letterSpacing: '0.04em' }}>
              GLIMPSE OF DEL
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={toggle} style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-muted)',
          }}>
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
          <NavLink to="/orders/new" className="btn btn-primary btn-sm">
            <Plus size={13} strokeWidth={2.5} />
            New Order
          </NavLink>
        </div>
      </header>

      {/* Page content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        position: 'sticky', bottom: 0, zIndex: 50,
      }}>
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 4, padding: '10px 0 12px',
            fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
            textDecoration: 'none', transition: 'color 0.15s',
            color: isActive ? 'var(--accent)' : 'var(--text-faint)',
          })}>
            {({ isActive }) => (
              <>
                <Icon size={19} strokeWidth={isActive ? 2.5 : 1.8} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
