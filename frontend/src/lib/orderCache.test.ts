import { describe, it, expect, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { keys } from './queryKeys'
import { putInQueue, putInOrders, Queue } from './orderCache'
import { Order } from '../types'

const order = (id: string, status: Order['status'], minute: number, extra: Partial<Order> = {}) => ({
  id, status, order_number: id, created_at: `2026-10-17T08:${String(minute).padStart(2, '0')}:00+00:00`,
  payment_status: 'unpaid', order_items: [], ...extra,
}) as unknown as Order

let qc: QueryClient
const queue = () => qc.getQueryData<Queue>(keys.queue)!
const ids = (lane: keyof Queue) => queue()[lane].map(o => o.id)

beforeEach(() => {
  qc = new QueryClient()
  qc.setQueryData<Queue>(keys.queue, {
    pending: [order('a', 'pending', 1), order('b', 'pending', 5)],
    brewing: [order('c', 'brewing', 0), order('d', 'brewing', 3)],
    ready: [],
  })
})

describe('putInQueue', () => {
  it('moves an order to its new lane, in created_at order', () => {
    putInQueue(qc, order('a', 'brewing', 1))
    expect(ids('pending')).toEqual(['b'])
    expect(ids('brewing')).toEqual(['c', 'a', 'd'])
    expect(queue().brewing[1].status).toBe('brewing')
  })

  it('takes a picked-up order off the queue', () => {
    putInQueue(qc, order('c', 'picked_up', 0))
    expect(ids('brewing')).toEqual(['d'])
    expect(ids('ready')).toEqual([])
  })

  it('putting the original back restores its lane and position', () => {
    const original = queue().pending[0]
    putInQueue(qc, { ...original, status: 'brewing' })
    putInQueue(qc, original)
    expect(ids('pending')).toEqual(['a', 'b'])
    expect(ids('brewing')).toEqual(['c', 'd'])
  })

  it('leaves an empty cache alone', () => {
    qc = new QueryClient()
    putInQueue(qc, order('a', 'brewing', 1))
    expect(qc.getQueryData(keys.queue)).toBeUndefined()
  })
})

describe('putInOrders', () => {
  it('replaces the order in place', () => {
    qc.setQueryData<Order[]>(keys.orders, [order('a', 'pending', 1), order('b', 'pending', 5)])
    putInOrders(qc, order('b', 'pending', 5, { payment_status: 'paid' }))
    const list = qc.getQueryData<Order[]>(keys.orders)!
    expect(list.map(o => o.id)).toEqual(['a', 'b'])
    expect(list[1].payment_status).toBe('paid')
  })
})
