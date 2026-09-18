import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersApi } from '../lib/api'
import { Order } from '../types'
import { NavLink } from 'react-router-dom'
import { Plus } from 'lucide-react'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', brewing: 'Brewing', ready: 'Ready',
  picked_up: 'Picked up', cancelled: 'Cancelled',
}
const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-pending', brewing: 'badge-brewing', ready: 'badge-ready',
  picked_up: 'badge-done', cancelled: 'badge-cancelled',
}

function OrderRow({ order }: { order: Order }) {
  const qc = useQueryClient()
  const markPaid = useMutation({
    mutationFn: () => ordersApi.markPaid(order.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] })
  })

  return (
    <div className="card p-4 mb-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-bold text-sm" style={{ color: 'var(--accent)' }}>
            {order.order_number}
          </span>
          <span className={`badge ${STATUS_BADGE[order.status]}`}>
            {STATUS_LABEL[order.status]}
          </span>
          {order.source === 'messenger' && (
            <span className="badge" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
              Messenger
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
          {new Date(order.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {order.customer_name && (
        <p className="text-xs mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>
          {order.customer_name}
        </p>
      )}

      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        {order.order_items.map((item, i) => (
          <span key={i}>
            {item.quantity}× {item.item_name}{i < order.order_items.length - 1 ? ', ' : ''}
          </span>
        ))}
      </p>

      <div className="flex items-center justify-between">
        <span className="font-mono font-bold" style={{ color: 'var(--text)' }}>
          ₱{Number(order.total_amount).toLocaleString()}
        </span>
        {order.payment_status === 'unpaid' && order.status !== 'cancelled' ? (
          <button
            onClick={() => markPaid.mutate()}
            disabled={markPaid.isPending}
            className="btn btn-primary text-xs px-3 py-1.5"
          >
            Mark paid
          </button>
        ) : order.payment_status === 'paid' ? (
          <span className="text-xs font-semibold" style={{ color: 'var(--ready)' }}>✓ Paid</span>
        ) : null}
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
      <div className="flex items-center justify-between mt-2 mb-5">
        <h1 className="font-display text-2xl" style={{ color: 'var(--text)' }}>Orders</h1>
        <NavLink to="/orders/new" className="btn btn-primary text-xs px-3 py-2">
          <Plus size={14} /> New
        </NavLink>
      </div>

      {isLoading && (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
          Loading orders…
        </div>
      )}

      {!isLoading && orders.length === 0 && (
        <div className="card p-8 text-center">
          <p className="font-display text-xl mb-1" style={{ color: 'var(--text)' }}>No orders yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Orders will appear here as they come in.
          </p>
          <NavLink to="/orders/new" className="btn btn-primary">
            Create first order
          </NavLink>
        </div>
      )}

      {orders.map((order: Order) => (
        <OrderRow key={order.id} order={order} />
      ))}
    </div>
  )
}
