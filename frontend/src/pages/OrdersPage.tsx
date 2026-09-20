import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersApi } from '../lib/api'
import { useWakeState } from '../hooks/useWakeState'
import { Order } from '../types'
import { NavLink } from 'react-router-dom'
import { Plus } from 'lucide-react'

const S_BADGE: Record<string, string> = {
  pending: 'badge-pending', brewing: 'badge-brewing', ready: 'badge-ready',
  picked_up: 'badge-done', cancelled: 'badge-cancelled',
}
const S_LABEL: Record<string, string> = {
  pending: 'Pending', brewing: 'Brewing', ready: 'Ready',
  picked_up: 'Picked up', cancelled: 'Cancelled',
}

function Row({ order, idx }: { order: Order, idx: number }) {
  const qc = useQueryClient()
  const markPaid = useMutation({
    mutationFn: () => ordersApi.markPaid(order.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] })
  })

  return (
    <article className="panel page-enter-child" style={{ marginBottom: 8, animationDelay: `${idx * 40}ms` }} aria-label={`Order ${order.order_number}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 8px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <span className="data" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{order.order_number}</span>
        <span className={`badge ${S_BADGE[order.status]}`}>{S_LABEL[order.status]}</span>
        {order.source === 'messenger' && (
          <span className="badge" style={{ background: 'rgba(0,212,255,0.08)', color: 'var(--brewing)' }}>DM</span>
        )}
        <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono', fontSize: 9, color: 'var(--t3)' }}>
          {new Date(order.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div style={{ padding: '8px 14px 12px' }}>
        {order.customer_name && (
          <p style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: 'var(--t3)', letterSpacing: '0.06em', marginBottom: 6 }}>
            {order.customer_name.toUpperCase()}
          </p>
        )}
        <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 10, lineHeight: 1.6 }}>
          {order.order_items.map((item, i) => (
            <span key={i}>{item.quantity}× {item.item_name}{i < order.order_items.length - 1 ? ' · ' : ''}</span>
          ))}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="data" style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)' }}>
            ₱{Number(order.total_amount).toLocaleString()}
          </span>
          {order.payment_status === 'unpaid' && order.status !== 'cancelled' ? (
            <button onClick={() => markPaid.mutate()} disabled={markPaid.isPending}
              className="btn btn-fire" aria-label={`Mark ${order.order_number} paid`}
              style={{ padding: '8px 18px', fontSize: 12 }}>
              {markPaid.isPending ? '···' : 'Mark paid'}
            </button>
          ) : order.payment_status === 'paid' ? (
            <span role="status" style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--ready)', letterSpacing: '0.06em' }}>PAID ✓</span>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default function OrdersPage() {
  const waking = useWakeState()
  const { data: orders = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['orders'], queryFn: () => ordersApi.getOrders(), refetchInterval: 15_000, retry: 2,
  })

  return (
    <div className="page-enter" style={{ padding: '16px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 className="display" style={{ fontSize: 40, color: 'var(--t1)', lineHeight: 0.95 }}>ORDERS</h1>
        <NavLink to="/orders/new" className="btn btn-fire" style={{ padding: '9px 18px', fontSize: 12 }}>
          <Plus size={12} strokeWidth={3} aria-hidden="true" /> New
        </NavLink>
      </div>

      {waking && (
        <div className="wake-banner" style={{ padding: '8px 12px', marginBottom: 12, background: 'var(--accent-bg)', border: '1px solid var(--accent-lo)', borderRadius: 'var(--r)' }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--accent)', letterSpacing: '0.06em' }}>WAKING SERVER···</span>
        </div>
      )}

      {isError && (
        <div style={{ padding: '12px 16px', marginBottom: 12, background: 'rgba(255,75,75,0.08)', border: '1px solid rgba(255,75,75,0.2)', borderRadius: 'var(--r)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--danger)' }}>COULDN'T LOAD ORDERS</span>
          <button onClick={() => refetch()} className="btn btn-danger" style={{ padding: '6px 14px', fontSize: 11 }}>Retry</button>
        </div>
      )}

      {isLoading && [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 110, marginBottom: 8 }} />)}

      {!isLoading && !isError && orders.length === 0 && (
        <div className="panel" role="status" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <p className="display" style={{ fontSize: 32, color: 'var(--t1)', marginBottom: 8 }}>NO ORDERS YET</p>
          <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 24 }}>Ready when your first customer is.</p>
          <NavLink to="/orders/new" className="btn btn-fire">Take an order</NavLink>
        </div>
      )}

      {orders.map((o: Order, i: number) => <Row key={o.id} order={o} idx={i} />)}
    </div>
  )
}
