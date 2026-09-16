import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersApi } from '../lib/api'
import { Order } from '../types'
import { NavLink } from 'react-router-dom'
import { Plus } from 'lucide-react'
import clsx from 'clsx'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  brewing: 'Brewing',
  ready: 'Ready',
  picked_up: 'Picked Up',
  cancelled: 'Cancelled',
}

const BADGE_CLASS: Record<string, string> = {
  pending:   'badge-pending',
  brewing:   'badge-brewing',
  ready:     'badge-ready',
  picked_up: 'badge-picked-up',
  cancelled: 'badge-cancelled',
}

function OrderRow({ order }: { order: Order }) {
  const qc = useQueryClient()
  const markPaid = useMutation({
    mutationFn: () => ordersApi.markPaid(order.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] })
  })

  return (
    <div className="card p-3 mb-2">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-brew-200 text-sm">{order.order_number}</span>
          <span className={clsx('text-xs px-2 py-0.5 rounded-full', BADGE_CLASS[order.status])}>
            {STATUS_LABELS[order.status]}
          </span>
        </div>
        <span className="text-xs text-roast-500">
          {new Date(order.created_at).toLocaleTimeString('en-PH', {
            hour: '2-digit', minute: '2-digit'
          })}
        </span>
      </div>

      {order.customer_name && (
        <p className="text-xs text-roast-400 mb-1">{order.customer_name}</p>
      )}

      <div className="text-xs text-roast-400 mb-2">
        {order.order_items.map((item, i) => (
          <span key={i}>
            {item.quantity}× {item.item_name}
            {i < order.order_items.length - 1 ? ', ' : ''}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="font-bold text-brew-300">₱{Number(order.total_amount).toLocaleString()}</span>
        {order.payment_status === 'unpaid' && order.status !== 'cancelled' && (
          <button
            onClick={() => markPaid.mutate()}
            disabled={markPaid.isPending}
            className="text-xs btn-primary py-1 px-2"
          >
            Mark Paid
          </button>
        )}
        {order.payment_status === 'paid' && (
          <span className="text-xs text-green-400">✓ Paid</span>
        )}
      </div>
    </div>
  )
}

export default function OrdersPage() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.getOrders(),
    refetchInterval: 15_000,
  })

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl font-bold text-brew-100">Orders</h1>
        <NavLink to="/orders/new" className="btn-primary flex items-center gap-1 text-sm py-1.5 px-3">
          <Plus size={14} /> New
        </NavLink>
      </div>

      {isLoading && (
        <div className="text-center text-roast-500 py-12">Loading orders...</div>
      )}

      {!isLoading && orders.length === 0 && (
        <div className="text-center text-roast-500 py-12">
          <p className="text-lg mb-2">No orders yet</p>
          <NavLink to="/orders/new" className="btn-primary text-sm">
            Create First Order
          </NavLink>
        </div>
      )}

      {orders.map((order: Order) => (
        <OrderRow key={order.id} order={order} />
      ))}
    </div>
  )
}
