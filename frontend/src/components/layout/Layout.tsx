import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Coffee, ListOrdered, UtensilsCrossed, Plus, Sun, Moon } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dash'   },
  { to: '/queue',     icon: Coffee,          label: 'Queue'  },
  { to: '/orders',    icon: ListOrdered,     label: 'Orders' },
  { to: '/menu',      icon: UtensilsCrossed, label: 'Menu'   },
]

export default function Layout() {
  const { theme, toggle } = useTheme()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* Topbar */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: 52,
        background: 'var(--s1)', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, background: 'var(--accent)',
            borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Coffee size={14} color="#141414" strokeWidth={2.5} />
          </div>
          <div>
            <div className="type-ui" style={{ fontSize: 14, color: 'var(--t1)', lineHeight: 1 }}>
              BrewOS
            </div>
            <div style={{ fontSize: 9, color: 'var(--t3)', lineHeight: 1, marginTop: 2, fontFamily: 'IBM Plex Mono', letterSpacing: '0.06em' }}>
              GLIMPSE OF DEL
            </div>
          </div>
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={toggle} style={{
            width: 28, height: 28, borderRadius: 4, border: '1px solid var(--border)',
            background: 'var(--s2)', color: 'var(--t2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
          </button>
          <NavLink to="/orders/new" className="btn btn-accent" style={{ padding: '7px 14px', fontSize: 11 }}>
            <Plus size={12} strokeWidth={3} />
            New order
          </NavLink>
        </div>
      </header>

      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav style={{
        display: 'flex',
        background: 'var(--s1)', borderTop: '1px solid var(--border)',
        position: 'sticky', bottom: 0, zIndex: 100,
      }}>
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            style={({ isActive }) => ({
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 3, padding: '10px 0 12px',
              textDecoration: 'none', transition: 'color 0.12s',
              fontFamily: 'IBM Plex Mono', fontSize: 9, fontWeight: 500,
              letterSpacing: '0.04em',
              color: isActive ? 'var(--accent)' : 'var(--t3)',
              borderTop: isActive ? '2px solid var(--accent)' : '2px solid transparent',
            })}>
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                {label.toUpperCase()}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
