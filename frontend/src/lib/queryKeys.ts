import { QueryClient } from '@tanstack/react-query'

// Every React Query key in one place. invalidateQueries matches by key
// prefix, so a literal typo — or a combined key like ['orders', 'queue',
// 'stats'], which is ONE key that matches nothing — fails silently and the
// screen just waits for its polling interval. Use these, never literal arrays.
export const keys = {
  menu: ['menu'] as const,          // order screen: available options only
  menuFull: ['menu-full'] as const, // Menu page: everything, so toggles can turn things back on
  orders: ['orders'] as const,
  queue: ['queue'] as const,
  stats: ['stats'] as const,
}

// After anything that changes an order: the queue, the orders list and the
// dashboard counts/revenue all read from it.
export function refreshOrders(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: keys.orders })
  qc.invalidateQueries({ queryKey: keys.queue })
  qc.invalidateQueries({ queryKey: keys.stats })
}

// After anything that changes the menu: both the Menu page and the order screen.
export function refreshMenus(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: keys.menu })
  qc.invalidateQueries({ queryKey: keys.menuFull })
}
