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
    <div className="card" style={{ padding: '14px 16px', marginBottom: 10 }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
            {order.order_number}
          </span>
          <span className={`badge ${STATUS_BADGE[order.status]}`}>
            {STATUS_LABEL[order.status]}
          </span>
          {order.source === 'messenger' && (
            <span className="badge" style={{ background: 'rgba(56,190,255,0.1)', color: 'var(--brewing)', border: '1px solid rgba(56,190,255,0.2)' }}>
              Messenger
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-faint)', fontWeight: 500 }}>
          {new Date(order.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Customer */}
      {order.customer_name && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.03em' }}>
          {order.customer_name.toUpperCase()}
        </p>
      )}

      {/* Items summary */}
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
        {order.order_items.map((item, i) => (
          <span key={i}>
            {item.quantity}× {item.item_name}{i < order.order_items.length - 1 ? ' · ' : ''}
          </span>
        ))}
      </p>

      {/* Bottom row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          ₱{Number(order.total_amount).toLocaleString()}
        </span>
        {order.payment_status === 'unpaid' && order.status !== 'cancelled' ? (
          <button onClick={() => markPaid.mutate()} disabled={markPaid.isPending}
            className="btn btn-primary btn-sm">
            Mark paid
          </button>
        ) : order.payment_status === 'paid' ? (
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ready)', letterSpacing: '0.04em' }}>✓ PAID</span>
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
    <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 className="font-display" style={{ fontSize: 28, color: 'var(--text)' }}>Orders</h1>
        <NavLink to="/orders/new" className="btn btn-primary btn-sm">
          <Plus size={13} /> New
        </NavLink>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          Loading…
        </div>
      )}

      {!isLoading && orders.length === 0 && (
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <p className="font-display" style={{ fontSize: 22, color: 'var(--text)', marginBottom: 8 }}>
            No orders yet
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Orders will appear here as they come in.
          </p>
          <NavLink to="/orders/new" className="btn btn-primary">
            Create first order
          </NavLink>
        </div>
      )}

      {orders.map((order: Order) => <OrderRow key={order.id} order={order} />)}
    </div>
  )
}
