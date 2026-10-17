import { QueryClient } from '@tanstack/react-query'
import { keys } from './queryKeys'
import { Order } from '../types'

// Edits to the cached queue and orders list, so a status change or a payment
// shows on tap instead of after the save AND a refetch (measured 2026-10-17:
// ~5 s on her phone before this). The request runs in the background; on
// failure the caller puts the order back as it was; when it settles, the
// refetch reconciles with the server. Same idea as menuCache.ts.

export type Lane = 'pending' | 'brewing' | 'ready'
export type Queue = Record<Lane, Order[]>
export const LANES: Lane[] = ['pending', 'brewing', 'ready']

// Server order is by created_at (backend queue.py), so a moved or restored
// order lands where the refetch will put it, not at the bottom of its lane.
const byCreated = (orders: Order[]) =>
  [...orders].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

// Put the order in the lane its status says, taking it out of any other.
// picked_up or cancelled: it leaves the queue. Moving an order is this with
// the next status; putting it back on failure is this with the original.
export function putInQueue(qc: QueryClient, order: Order) {
  // Drop any fetch in flight: it started before this change and would
  // overwrite it with what the server had then.
  qc.cancelQueries({ queryKey: keys.queue })
  qc.setQueryData<Queue>(keys.queue, q => {
    if (!q) return q
    const next = {} as Queue
    for (const lane of LANES) {
      const rest = (q[lane] ?? []).filter(o => o.id !== order.id)
      next[lane] = order.status === lane ? byCreated([...rest, order]) : rest
    }
    return next
  })
}

// Replace the order in the orders list, where it is. Also used to put it back.
export function putInOrders(qc: QueryClient, order: Order) {
  qc.cancelQueries({ queryKey: keys.orders })
  qc.setQueryData<Order[]>(keys.orders, list => list?.map(o => o.id === order.id ? order : o))
}
