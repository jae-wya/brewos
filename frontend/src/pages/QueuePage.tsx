import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queueApi, ordersApi } from '../lib/api'
import { useWakeState } from '../hooks/useWakeState'
import { Order } from '../types'

const COLS = [
  { key: 'pending', label: 'Pending', next: 'brewing',   action: 'Start brewing', dotClass: 'dot-pending', color: 'var(--pending)' },
  { key: 'brewing', label: 'Brewing', next: 'ready',     action: 'Mark ready',    dotClass: 'dot-brewing', color: 'var(--brewing)' },
  { key: 'ready',   label: 'Ready',   next: 'picked_up', action: 'Picked up ✓',  dotClass: 'dot-ready',   color: 'var(--ready)'   },
]

function KDSCard({ order, next, action, dotClass }: {
  order: Order, next: string, action: string, dotClass: string
}) {
  const qc = useQueryClient()
  const [flipping, setFlipping] = useState(false)

  // Check if order is >10 min old
  const ageMinutes = (Date.now() - new Date(order.created_at).getTime()) / 60000
  const isUrgent = ageMinutes > 10

  const advance = useMutation({
    mutationFn: () => ordersApi.updateStatus(order.id, next),
    onMutate: () => setFlipping(true),
    onSuccess: () => {
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['queue'] })
        setFlipping(false)
      }, 280)
    },
    onError: () => setFlipping(false),
  })

  return (
    <div className="flip-wrapper" style={{ marginBottom: 8 }}>
      <div className={`flip-card ${flipping ? 'flipping' : ''}`}>
        <div className={isUrgent ? 'heat-border heat-border-urgent' : 'heat-border'}>
          {/* Card header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px 6px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--s2)',
            borderRadius: 'var(--r) var(--r) 0 0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div className={`dot ${dotClass}`} role="img" aria-label={dotClass.replace('dot-', '')} />
              <span className="data" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                {order.order_number}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isUrgent && (
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: 'var(--danger)', letterSpacing: '0.06em' }}>
                  {Math.floor(ageMinutes)}M
                </span>
              )}
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: 'var(--t3)' }}>
                {new Date(order.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <div style={{ padding: '8px 12px', background: 'var(--s1)', borderRadius: '0 0 var(--r) var(--r)' }}>
            {order.customer_name && (
              <p style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: 'var(--t3)', letterSpacing: '0.06em', marginBottom: 6 }}>
                {order.customer_name.toUpperCase()}
              </p>
            )}
            {order.order_items.map((item, i) => (
              <div key={i} className="kds-row">
                <span className="data" style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0, minWidth: 16 }}>{item.quantity}×</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', lineHeight: 1.3 }}>{item.item_name}</p>
                  {item.order_item_modifiers.length > 0 && (
                    <p style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: 'var(--t3)', marginTop: 2 }}>
                      {item.order_item_modifiers.map(m => m.option_name).join(' · ')}
                    </p>
                  )}
                  {item.notes && <p style={{ fontSize: 10, color: 'var(--t2)', fontStyle: 'italic', marginTop: 2 }}>{item.notes}</p>}
                </div>
              </div>
            ))}
            <button
              onClick={() => advance.mutate()}
              disabled={advance.isPending}
              className="btn btn-fire"
              style={{ width: '100%', marginTop: 10, padding: '9px', fontSize: 11 }}
              aria-label={`${action} for ${order.order_number}`}
            >
              {advance.isPending ? '···' : action}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function QueuePage() {
  const qc = useQueryClient()
  const waking = useWakeState()
  const [activeTab, setActiveTab] = useState<string | null>(null)

  const { data: queue, isLoading, isError, refetch } = useQuery({
    queryKey: ['queue'],
    queryFn: queueApi.getQueue,
    refetchInterval: 8_000,
    retry: 2,
  })

  const total = COLS.reduce((s, c) => s + (queue?.[c.key]?.length ?? 0), 0)
  const defaultTab = COLS.find(c => (queue?.[c.key]?.length ?? 0) > 0)?.key ?? 'pending'
  const mobileActive = activeTab ?? defaultTab

  // Auto-switch tab when new orders arrive in a different column
  useEffect(() => {
    if (!activeTab && queue) {
      const first = COLS.find(c => (queue[c.key]?.length ?? 0) > 0)
      if (first) setActiveTab(first.key)
    }
  }, [queue, activeTab])

  if (isLoading) return (
    <div className="page-enter" style={{ padding: 16 }}>
      <div className="skeleton" style={{ width: 100, height: 36, marginBottom: 8 }} />
      <div className="skeleton" style={{ width: 140, height: 14, marginBottom: 20 }} />
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 120, marginBottom: 8 }} />)}
    </div>
  )

  return (
    <div className="page-enter" style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 className="display" style={{ fontSize: 40, color: 'var(--t1)', lineHeight: 0.95 }}>QUEUE</h1>
          <p style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: 'var(--t3)', marginTop: 6, letterSpacing: '0.06em' }}>
            {total} ORDER{total !== 1 ? 'S' : ''} ACTIVE
          </p>
        </div>
        <button onClick={() => refetch()} className="icon-btn" aria-label="Refresh queue" style={{ width: 40, height: 40 }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 14 }}>↺</span>
        </button>
      </div>

      {waking && (
        <div className="wake-banner" style={{ padding: '8px 12px', marginBottom: 12, background: 'var(--accent-bg)', border: '1px solid var(--accent-lo)', borderRadius: 'var(--r)' }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--accent)', letterSpacing: '0.06em' }}>WAKING SERVER···</span>
        </div>
      )}

      {isError && (
        <div style={{ padding: '12px 16px', marginBottom: 12, background: 'rgba(255,75,75,0.08)', border: '1px solid rgba(255,75,75,0.2)', borderRadius: 'var(--r)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--danger)' }}>SERVER UNREACHABLE</span>
          <button onClick={() => refetch()} className="btn btn-danger" style={{ padding: '5px 12px', fontSize: 10 }}>Retry</button>
        </div>
      )}

      {/* ── Mobile: status tabs ── */}
      <div className="md-hidden">
        <div style={{ display: 'flex', background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 'var(--r)', marginBottom: 14, overflow: 'hidden' }}>
          {COLS.map(({ key, label, color, dotClass }) => {
            const count = queue?.[key]?.length ?? 0
            const isActive = mobileActive === key
            return (
              <button key={key} onClick={() => setActiveTab(key)}
                aria-pressed={isActive}
                aria-label={`${label}, ${count} orders`}
                style={{
                  flex: 1, padding: '12px 4px', border: 'none',
                  background: isActive ? 'var(--s2)' : 'transparent',
                  borderBottom: isActive ? `2px solid ${color}` : '2px solid transparent',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  transition: 'all 0.15s',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div className={`dot ${dotClass}`} style={{ width: 5, height: 5 }} aria-hidden="true" />
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 8, fontWeight: 700, color, letterSpacing: '0.08em' }}>
                    {label.toUpperCase()}
                  </span>
                </div>
                <span className="data" style={{ fontSize: 24, fontWeight: 700, color: isActive ? color : 'var(--t3)', lineHeight: 1 }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Active column */}
        {(() => {
          const col = COLS.find(c => c.key === mobileActive)!
          const orders: Order[] = queue?.[mobileActive] ?? []
          return orders.length === 0 ? (
            <div style={{ border: '1px dashed var(--border)', borderRadius: 'var(--r)', padding: '48px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--t3)', letterSpacing: '0.06em' }}>
                NO {col.label.toUpperCase()} ORDERS
              </p>
            </div>
          ) : (
            orders.map((order: Order) => (
              <KDSCard key={order.id} order={order} next={col.next} action={col.action} dotClass={col.dotClass} />
            ))
          )
        })()}
      </div>

      {/* ── Desktop: 3-col grid ── */}
      <div style={{ display: 'none' }} className="md-grid-3">
        {COLS.map(({ key, label, next, action, dotClass, color }) => (
          <div key={key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${color}` }}>
              <div className={`dot ${dotClass}`} style={{ width: 5, height: 5 }} aria-hidden="true" />
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9, fontWeight: 700, color, letterSpacing: '0.1em' }}>{label.toUpperCase()}</span>
              <span className="data" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t3)' }}>{queue?.[key]?.length ?? 0}</span>
            </div>
            {(queue?.[key]?.length ?? 0) === 0 ? (
              <div style={{ border: '1px dashed var(--border)', borderRadius: 'var(--r)', padding: '28px 8px', textAlign: 'center' }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: 'var(--t3)' }}>EMPTY</span>
              </div>
            ) : queue?.[key]?.map((order: Order) => (
              <KDSCard key={order.id} order={order} next={next} action={action} dotClass={dotClass} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
