import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queueApi, ordersApi } from '../lib/api'
import { useWakeState } from '../hooks/useWakeState'
import { Order } from '../types'
import OrderLine from '../components/orders/OrderLine'
import { keys, refreshOrders } from '../lib/queryKeys'
import { orderHeat } from '../lib/heat'

const COLS = [
  { key: 'pending', label: 'Pending', next: 'brewing',   action: 'Start brewing', dotClass: 'dot-pending', color: 'var(--pending)' },
  { key: 'brewing', label: 'Brewing', next: 'ready',     action: 'Mark ready',    dotClass: 'dot-brewing', color: 'var(--brewing)' },
  { key: 'ready',   label: 'Ready',   next: 'picked_up', action: 'Picked up ✓',  dotClass: 'dot-ready',   color: 'var(--ready)'   },
]

// One order as her paper chit, hanging on the rail. Heat (lib/heat.ts) is
// how late it's running — an ember edge that grows as it gets later — and
// the time is always written too. Recomputed on every refresh (8s); nothing
// animates while it waits. Advancing it slides it off along the rail toward
// the next lane.
function Chit({ order, next, action }: { order: Order, next: string, action: string }) {
  const qc = useQueryClient()
  const [leaving, setLeaving] = useState(false)
  const heat = orderHeat(order, new Date())
  const time = new Date(order.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })

  const advance = useMutation({
    mutationFn: () => ordersApi.updateStatus(order.id, next),
    onMutate: () => setLeaving(true),
    onSuccess: () => { setTimeout(() => refreshOrders(qc), 260) },
    onError: () => setLeaving(false), // slides back onto the rail
  })

  return (
    <article className="chit" data-heat={heat.level || undefined} aria-label={`Order ${order.order_number}`}
      style={{ marginBottom: 18, animation: leaving ? 'chitLeave 0.26s ease-in forwards' : undefined }}>
      <div style={{ padding: '14px 14px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p className="display" style={{ fontSize: 30, color: 'var(--ink)', lineHeight: 0.9 }}>{order.order_number}</p>
          <p className="data" style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 4 }}>
            {order.customer_name ? `${order.customer_name} · ` : ''}{time}
          </p>
        </div>
        {/* Late: stamped, ink on ember. Otherwise quiet. Always in words. */}
        <span className="data" style={heat.level === 3
          ? { flexShrink: 0, background: 'var(--ember)', color: 'var(--ink)', fontSize: 12, fontWeight: 700, padding: '5px 8px', borderRadius: 2, letterSpacing: '0.06em', textTransform: 'uppercase' }
          : { flexShrink: 0, color: 'var(--ink-2)', fontSize: 12, fontWeight: heat.level ? 700 : 500, paddingTop: 4 }}>
          {heat.label}
        </span>
      </div>

      <div style={{ padding: '0 14px 14px' }}>
        {order.notes && (
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', margin: '6px 0 2px' }}>{order.notes}</p>
        )}
        {order.order_items.map(item => (
          <OrderLine key={item.id} variant="chit"
            quantity={item.quantity} name={item.item_name} category={item.item_category}
            modifiers={item.order_item_modifiers.map(m => m.option_name)} notes={item.notes} />
        ))}
        <button
          onClick={() => advance.mutate()}
          disabled={advance.isPending}
          className="btn btn-fire"
          style={{ width: '100%', marginTop: 12, minHeight: 48, fontSize: 14 }}
          aria-label={`${action} for ${order.order_number}`}
        >
          {advance.isPending ? '···' : action}
        </button>
      </div>
    </article>
  )
}

export default function QueuePage() {
  const qc = useQueryClient()
  const waking = useWakeState()
  const [activeTab, setActiveTab] = useState<string | null>(null)

  const { data: queue, isLoading, isError, refetch } = useQuery({
    queryKey: keys.queue,
    queryFn: queueApi.getQueue,
    refetchInterval: 8_000,
    retry: 2,
  })

  const total = COLS.reduce((s, c) => s + (queue?.[c.key]?.length ?? 0), 0)

  // A lane's count bumps when a chit arrives in it — the other end of the
  // chit sliding off its old lane.
  const prevCounts = useRef<Record<string, number>>({})
  const [bumped, setBumped] = useState<Record<string, number>>({})
  useEffect(() => {
    if (!queue) return
    const grew: Record<string, number> = {}
    for (const c of COLS) {
      const n = queue[c.key]?.length ?? 0
      if (prevCounts.current[c.key] !== undefined && n > prevCounts.current[c.key]) grew[c.key] = Date.now()
      prevCounts.current[c.key] = n
    }
    if (Object.keys(grew).length) setBumped(b => ({ ...b, ...grew }))
  }, [queue])
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
          <p style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--t2)', marginTop: 6, letterSpacing: '0.06em' }}>
            {total} ORDER{total !== 1 ? 'S' : ''} ACTIVE
          </p>
        </div>
        <button onClick={() => refetch()} className="icon-btn" aria-label="Refresh queue">
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
        <div className="panel" style={{ display: 'flex', overflow: 'hidden' }}>
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
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, color, letterSpacing: '0.08em' }}>
                    {label.toUpperCase()}
                  </span>
                </div>
                <span key={bumped[key] ?? 0} className="display" style={{ fontSize: 36, color: isActive ? color : 'var(--t2)', lineHeight: 0.9, animation: bumped[key] ? 'countBump 0.3s ease-out' : undefined }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* The rail */}
        <div aria-hidden="true" style={{ height: 3, margin: '12px -16px 22px', background: 'var(--border-hi)', boxShadow: 'inset 0 1px 0 var(--rim), 0 6px 10px -6px var(--cast)' }} />

        {/* Active column */}
        {(() => {
          const col = COLS.find(c => c.key === mobileActive)!
          const orders: Order[] = queue?.[mobileActive] ?? []
          return orders.length === 0 ? (
            <div style={{ border: '1px dashed var(--border)', borderRadius: 'var(--r)', padding: '48px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--t2)', letterSpacing: '0.06em' }}>
                NO {col.label.toUpperCase()} ORDERS
              </p>
            </div>
          ) : (
            orders.map((order: Order) => (
              <Chit key={order.id} order={order} next={col.next} action={col.action} />
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
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, color, letterSpacing: '0.1em' }}>{label.toUpperCase()}</span>
              <span className="data" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t2)' }}>{queue?.[key]?.length ?? 0}</span>
            </div>
            {(queue?.[key]?.length ?? 0) === 0 ? (
              <div style={{ border: '1px dashed var(--border)', borderRadius: 'var(--r)', padding: '28px 8px', textAlign: 'center' }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--t2)' }}>EMPTY</span>
              </div>
            ) : queue?.[key]?.map((order: Order) => (
              <Chit key={order.id} order={order} next={next} action={action} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
