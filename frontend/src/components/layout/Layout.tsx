import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, ListOrdered, Plus, Coffee, UtensilsCrossed } from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/queue',     icon: Coffee,          label: 'Queue' },
  { to: '/orders',    icon: ListOrdered,     label: 'Orders' },
  { to: '/menu',      icon: UtensilsCrossed, label: 'Menu' },
]

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="bg-roast-800 border-b border-roast-700 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brew-500 rounded-lg flex items-center justify-center">
            <Coffee size={16} className="text-white" />
          </div>
          <div>
            <p className="font-display font-bold text-brew-100 leading-none text-sm">BrewOS</p>
            <p className="text-roast-400 text-xs leading-none mt-0.5">Glimpse of Del</p>
          </div>
        </div>
        <NavLink
          to="/orders/new"
          className="btn-primary flex items-center gap-1.5 text-sm py-1.5 px-3"
        >
          <Plus size={15} />
          New Order
        </NavLink>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="bg-roast-800 border-t border-roast-700 flex sticky bottom-0 z-50">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => clsx(
              'flex-1 flex flex-col items-center gap-1 py-2.5 text-xs transition-colors',
              isActive
                ? 'text-brew-400'
                : 'text-roast-400 hover:text-brew-300'
            )}
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
