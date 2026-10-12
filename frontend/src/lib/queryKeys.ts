import { QueryClient } from '@tanstack/react-query'

// Every React Query key in one place. invalidateQueries matches by key
// prefix, so a literal typo — or a combined key like ['orders', 'queue',
// 'stats'], which is ONE key that matches nothing — fails silently and the
// screen just waits for its polling interval. Use these, never literal arrays.
export const keys = {
  // ONE menu for both screens: everything, turned-off items and add-ons
  // included. The order screen hides those itself. Two cached copies had to
  // be kept in step by hand, and every way they drifted was a bug.
  menu: ['menu'] as const,
  orders: ['orders'] as const,
  queue: ['queue'] as const,
  stats: ['stats'] as const,
  sales: ['sales'] as const,
}

// After anything that changes an order: the queue, the orders list, the
// dashboard counts/revenue and daily sales all read from it.
export function refreshOrders(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: keys.orders })
  qc.invalidateQueries({ queryKey: keys.queue })
  qc.invalidateQueries({ queryKey: keys.stats })
  qc.invalidateQueries({ queryKey: keys.sales })
}
