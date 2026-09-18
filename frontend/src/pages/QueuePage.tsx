import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queueApi, ordersApi } from '../lib/api'
import { Order } from '../types'

const COLS = [
  { key: 'pending', label: 'Pending', next: 'brewing',   action: 'Brew', dotClass: 'dot-pending', color: 'var(--pending)' },
  { key: 'brewing', label: 'Brewing', next: 'ready',     action: 'Ready', dotClass: 'dot-brewing', color: 'var(--brewing)' },
  { key: 'ready',   label: 'Ready',   next: 'picked_up', action: 'Done', dotClass: 'dot-ready',   color: 'var(--ready)'   },
]

function KDSCard({ order, next, action, dotClass }: {
  order: Order, next: string, action: string, dotClass: string
}) {
  const qc = useQueryClient()
  const advance = useMutation({
    mutationFn: () => ordersApi.updateStatus(order.id, next),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queue'] })
  })

  return (
    <div className="panel" style={{ marginBottom: 6, overflow: 'hidden' }}>
      {/* Order header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px 6px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--s2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div className={`dot ${dotClass}`} />
          <span className="type-data" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
            {order.order_number}
          </span>
        </div>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--t3)', letterSpacing: '0.04em' }}>
          {new Date(order.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Items — KDS style */}
      <div style={{ padding: '8px 12px' }}>
        {order.customer_name && (
          <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--t3)', letterSpacing: '0.06em', marginBottom: 6 }}>
            {order.customer_name.toUpperCase()}
          </p>
        )}
        {order.order_items.map((item, i) => (
          <div key={i} className="kds-row" style={{ gap: 8 }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--t3)', flexShrink: 0, minWidth: 14 }}>
              {item.quantity}×
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', lineHeight: 1.3 }}>
                {item.item_name}
              </p>
              {item.order_item_modifiers.length > 0 && (
                <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--t3)', marginTop: 2 }}>
                  {item.order_item_modifiers.map(m => m.option_name).join(' · ')}
                </p>
              )}
              {item.notes && (
                <p style={{ fontSize: 10, color: 'var(--t2)', fontStyle: 'italic', marginTop: 2 }}>
                  {item.notes}
                </p>
              )}
            </div>
          </div>
        ))}
        <button
          onClick={() => advance.mutate()}
          disabled={advance.isPending}
          className="btn btn-accent"
          style={{ width: '100%', marginTop: 10, padding: '8px', fontSize: 11 }}
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--t3)' }}>LOADING···</span>
    </div>
  )

  const total = COLS.reduce((s, c) => s + (queue?.[c.key]?.length ?? 0), 0)

  return (
    <div style={{ padding: '16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 className="type-display" style={{ fontSize: 24, color: 'var(--t1)', lineHeight: 1 }}>
            Queue
          </h1>
          <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--t3)', marginTop: 3, letterSpacing: '0.04em' }}>
            {total} ORDER{total !== 1 ? 'S' : ''} ACTIVE
          </p>
        </div>
        <button onClick={() => qc.invalidateQueries({ queryKey: ['queue'] })}
          style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--t3)', cursor: 'pointer', background: 'none', border: 'none', letterSpacing: '0.06em' }}>
          REFRESH
        </button>
      </div>

      {/* 3-col KDS grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {COLS.map(({ key, label, next, action, dotClass, color }) => (
          <div key={key}>
            {/* Column header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8, marginBottom: 8, borderBottom: `1px solid ${color}` }}>
              <div className={`dot ${dotClass}`} style={{ width: 5, height: 5 }} />
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, fontWeight: 700, color, letterSpacing: '0.1em' }}>
                {label.toUpperCase()}
              </span>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--t3)', marginLeft: 'auto' }}>
                {queue?.[key]?.length ?? 0}
              </span>
            </div>

            {(queue?.[key]?.length ?? 0) === 0 && (
              <div style={{ border: '1px dashed var(--border)', borderRadius: 4, padding: '24px 8px', textAlign: 'center' }}>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--t3)' }}>EMPTY</span>
              </div>
            )}

            {queue?.[key]?.map((order: Order) => (
              <KDSCard key={order.id} order={order} next={next} action={action} dotClass={dotClass} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
