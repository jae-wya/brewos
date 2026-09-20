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
        padding: '0 14px', height: 52,
        background: 'var(--s1)', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Coffee size={14} color="#141414" strokeWidth={2.5} aria-hidden="true" />
          </div>
          <div>
            <div className="type-ui" style={{ fontSize: 14, color: 'var(--t1)', lineHeight: 1 }}>BrewOS</div>
            <div style={{ fontSize: 9, color: 'var(--t3)', lineHeight: 1, marginTop: 2, fontFamily: 'IBM Plex Mono', letterSpacing: '0.06em' }}>
              GLIMPSE OF DEL
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="icon-btn"
            style={{ width: 36, height: 36 }}
          >
            {theme === 'dark' ? <Sun size={13} aria-hidden="true" /> : <Moon size={13} aria-hidden="true" />}
          </button>
          <NavLink to="/orders/new" className="btn btn-accent" style={{ padding: '8px 14px', fontSize: 12 }}>
            <Plus size={12} strokeWidth={3} aria-hidden="true" />
            New order
          </NavLink>
        </div>
      </header>

      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>

      {/* Bottom nav — 5px bottom padding for safe area */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        style={{
          display: 'flex',
          background: 'var(--s1)', borderTop: '1px solid var(--border)',
          position: 'sticky', bottom: 0, zIndex: 100,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            aria-label={label}
            style={({ isActive }) => ({
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 3,
              padding: '10px 0 12px',
              textDecoration: 'none', transition: 'color 0.12s',
              fontFamily: 'IBM Plex Mono', fontSize: 9, fontWeight: 500,
              letterSpacing: '0.04em',
              color: isActive ? 'var(--accent)' : 'var(--t3)',
              borderTop: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              minHeight: 'var(--touch)',
            })}>
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} aria-hidden="true" />
                {label.toUpperCase()}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
