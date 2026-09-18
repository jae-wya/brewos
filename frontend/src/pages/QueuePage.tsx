import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queueApi, ordersApi } from '../lib/api'
import { Order } from '../types'
import { Clock, Flame, CheckCheck, RotateCcw } from 'lucide-react'

const COLS = [
  { key: 'pending', label: 'Pending', icon: Clock,      next: 'brewing',   action: 'Start Brewing', color: 'var(--pending)', stripe: 'stripe-pending' },
  { key: 'brewing', label: 'Brewing', icon: Flame,      next: 'ready',     action: 'Mark Ready',    color: 'var(--brewing)', stripe: 'stripe-brewing' },
  { key: 'ready',   label: 'Ready',   icon: CheckCheck, next: 'picked_up', action: 'Picked Up ✓',  color: 'var(--ready)',   stripe: 'stripe-ready'   },
]

function OrderCard({ order, next, action, stripe }: {
  order: Order, next: string, action: string, stripe: string
}) {
  const qc = useQueryClient()
  const advance = useMutation({
    mutationFn: () => ordersApi.updateStatus(order.id, next),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queue'] })
  })

  return (
    <div className={`card queue-stripe ${stripe}`} style={{ marginBottom: 8 }}>
      <div style={{ padding: '10px 12px 10px 0' }}>
        {/* Order number + time */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
            {order.order_number}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-faint)', fontWeight: 500 }}>
            {new Date(order.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Customer */}
        {order.customer_name && (
          <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.03em' }}>
            {order.customer_name.toUpperCase()}
          </p>
        )}

        {/* Items */}
        <div style={{ marginBottom: 10 }}>
          {order.order_items.map((item, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--text-faint)' }}>{item.quantity}×</span> {item.item_name}
              {item.order_item_modifiers.length > 0 && (
                <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>
                  {' '}· {item.order_item_modifiers.map(m => m.option_name).join(', ')}
                </span>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => advance.mutate()}
          disabled={advance.isPending}
          className="btn btn-primary"
          style={{ width: '100%', padding: '8px 12px', fontSize: 11 }}
        >
          {advance.isPending ? '···' : action}
        </button>
      </div>
    </div>
  )
}

export default function QueuePage() {
  const qc = useQueryClient()
  const { data: queue, isLoading } = useQuery({
    queryKey: ['queue'],
    queryFn: queueApi.getQueue,
    refetchInterval: 8_000,
  })

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)', fontSize: 13 }}>
      Loading queue…
    </div>
  )

  const total = COLS.reduce((s, c) => s + (queue?.[c.key]?.length ?? 0), 0)

  return (
    <div style={{ padding: '20px 16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 28, color: 'var(--text)', lineHeight: 1 }}>
            Live Queue
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {total} active order{total !== 1 ? 's' : ''} · auto-refreshes
          </p>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['queue'] })}
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-muted)',
          }}
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* 3 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {COLS.map(({ key, label, icon: Icon, next, action, color, stripe }) => (
          <div key={key}>
            {/* Column header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, paddingBottom: 8, borderBottom: `2px solid ${color}` }}>
              <Icon size={12} style={{ color }} strokeWidth={2.5} />
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color, textTransform: 'uppercase' }}>
                {label}
              </span>
              <span className="font-mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-faint)', fontWeight: 700 }}>
                {queue?.[key]?.length ?? 0}
              </span>
            </div>

            {/* Empty state */}
            {(queue?.[key]?.length ?? 0) === 0 && (
              <div style={{
                border: '1px dashed var(--border)',
                borderRadius: 10,
                padding: '20px 8px',
                textAlign: 'center',
              }}>
                <p style={{ fontSize: 10, color: 'var(--text-faint)' }}>Empty</p>
              </div>
            )}

            {/* Cards */}
            {queue?.[key]?.map((order: Order) => (
              <OrderCard key={order.id} order={order} next={next} action={action} stripe={stripe} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
