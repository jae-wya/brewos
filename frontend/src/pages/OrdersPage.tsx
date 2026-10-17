import { useQuery, useMutation, useQueryClient, useIsMutating } from '@tanstack/react-query'
import { ordersApi, errorMessage } from '../lib/api'
import { useWakeState } from '../hooks/useWakeState'
import { Order } from '../types'
import OrderLine from '../components/orders/OrderLine'
import { keys, refreshOrders } from '../lib/queryKeys'
import { putInOrders } from '../lib/orderCache'
import { NavLink } from 'react-router-dom'

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
  // Optimistic: PAID ✓ on tap, so there's no window where the button comes
  // back and invites a second tap. The order as it was rides in the context:
  // by onError this component has re-rendered, and `order` is the paid one.
  const markPaid = useMutation({
    mutationKey: ['markPaid'],
    mutationFn: () => ordersApi.markPaid(order.id),
    onMutate: () => {
      putInOrders(qc, { ...order, payment_status: 'paid' })
      return { before: order }
    },
    onError: (_err, _vars, ctx) => { if (ctx) putInOrders(qc, ctx.before) },
    onSuccess: () => refreshOrders(qc)
  })

  return (
    <article className="panel page-enter-child" style={{ marginBottom: 8, animationDelay: `${idx * 40}ms` }} aria-label={`Order ${order.order_number}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 8px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <span className="data" style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{order.order_number}</span>
        <span className={`badge ${S_BADGE[order.status]}`}>{S_LABEL[order.status]}</span>
        {order.source === 'messenger' && (
          <span className="badge" style={{ background: 'color-mix(in srgb, var(--brewing) 8%, transparent)', color: 'var(--brewing)' }}>DM</span>
        )}
        <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--t2)' }}>
          {new Date(order.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div style={{ padding: '8px 14px 12px' }}>
        {order.customer_name && (
          <p style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: 'var(--t2)', letterSpacing: '0.06em', marginBottom: 6 }}>
            {order.customer_name.toUpperCase()}
          </p>
        )}
        {order.notes && (
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)', marginBottom: 6 }}>{order.notes}</p>
        )}
        <div style={{ marginBottom: 10 }}>
          {order.order_items.map(item => (
            <OrderLine key={item.id}
              quantity={item.quantity} name={item.item_name} category={item.item_category}
              modifiers={item.order_item_modifiers.map(m => m.option_name)} notes={item.notes} />
          ))}
        </div>
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
        {/* A payment that didn't save must say so: otherwise she believes it's paid. */}
        {markPaid.isError && (
          <p role="alert" style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', marginTop: 8 }}>
            Not marked paid — still unpaid. {errorMessage(markPaid.error)}
          </p>
        )}
      </div>
    </article>
  )
}

export default function OrdersPage() {
  const waking = useWakeState()
  // A poll that lands mid-save would show it unpaid again until the next one.
  const saving = useIsMutating({ mutationKey: ['markPaid'] }) > 0
  const { data: orders = [], isLoading, isError, refetch } = useQuery({
    queryKey: keys.orders, queryFn: () => ordersApi.getOrders(), refetchInterval: saving ? false : 15_000, retry: 2,
  })

  return (
    <div className="page-enter" style={{ padding: '16px', maxWidth: 480, margin: '0 auto' }}>
      {/* No New button here: the header's New order covers this page. */}
      <h1 className="display" style={{ fontSize: 40, color: 'var(--t1)', lineHeight: 0.95, marginBottom: 20 }}>ORDERS</h1>

      {waking && (
        <div className="wake-banner" style={{ padding: '8px 12px', marginBottom: 12, background: 'var(--s2)', border: '1px solid var(--border-hi)', borderRadius: 'var(--r)' }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--t2)', letterSpacing: '0.06em' }}>WAKING SERVER···</span>
        </div>
      )}

      {isError && (
        <div style={{ padding: '12px 16px', marginBottom: 12, background: 'color-mix(in srgb, var(--danger) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)', borderRadius: 'var(--r)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
