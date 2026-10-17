import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient, useIsMutating, useMutationState } from '@tanstack/react-query'
import { queueApi, ordersApi, errorMessage } from '../lib/api'
import { useWakeState } from '../hooks/useWakeState'
import { Order } from '../types'
import OrderLine from '../components/orders/OrderLine'
import { keys, refreshOrders } from '../lib/queryKeys'
import { orderHeat } from '../lib/heat'
import { putInQueue, Lane, Queue } from '../lib/orderCache'

const COLS: { key: Lane, label: string, next: Order['status'], action: string, dotClass: string, color: string }[] = [
  { key: 'pending', label: 'Pending', next: 'brewing',   action: 'Start brewing', dotClass: 'dot-pending', color: 'var(--t1)' },
  { key: 'brewing', label: 'Brewing', next: 'ready',     action: 'Mark ready',    dotClass: 'dot-brewing', color: 'var(--brewing)' },
  { key: 'ready',   label: 'Ready',   next: 'picked_up', action: 'Picked up ✓',  dotClass: 'dot-ready',   color: 'var(--ready)'   },
]

const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

type Advance = { order: Order, next: Order['status'] }

// One order as her paper chit, hanging on the rail. Heat (lib/heat.ts) is
// how late it's running — an ember edge that grows as it gets later — and
// the time is always written too. Recomputed on every refresh (8s); nothing
// animates while it waits.
//
// Advancing it moves the order to the next lane in the cache on tap (see
// QueuePage); what slides off along the rail is a departing copy, `leaving`,
// which can't be tapped and is gone when the slide ends.
function Chit({ order, action, onAdvance, error, saving, leaving, onLeft }: {
  order: Order, action: string, onAdvance?: () => void, error?: string, saving?: boolean, leaving?: boolean, onLeft?: () => void,
}) {
  const heat = orderHeat(order, new Date())
  const time = new Date(order.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })

  return (
    <article className="chit" data-heat={heat.level || undefined} aria-label={`Order ${order.order_number}`}
      aria-hidden={leaving || undefined}
      onAnimationEnd={e => { if (e.animationName === 'chitLeave') onLeft?.() }}
      style={{ marginBottom: 18, animation: leaving ? 'chitLeave 0.26s ease-in forwards' : undefined, pointerEvents: leaving ? 'none' : undefined }}>
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
        {/* Back on the rail after a failed save, and says why: seeing it
            reappear isn't enough to know the drink is still pending on the server. */}
        {error && (
          <p role="alert" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-danger)', marginTop: 12 }}>
            Not moved — still {order.status}. {error}
          </p>
        )}
        <button
          onClick={onAdvance}
          disabled={leaving || saving}
          aria-busy={saving || undefined}
          tabIndex={leaving ? -1 : undefined}
          // Ink on the paper, not the tungsten gradient: with a rail of
          // chits the gradient was seven loud buttons, drowning out the heat.
          className="btn"
          style={{ width: '100%', marginTop: 12, minHeight: 48, fontSize: 14, background: 'var(--ink)', color: 'var(--paper)', borderRadius: 'var(--r)' }}
          aria-label={`${action} for ${order.order_number}`}
        >
          {saving ? '···' : action}
        </button>
      </div>
    </article>
  )
}

export default function QueuePage() {
  const qc = useQueryClient()
  const waking = useWakeState()
  const [activeTab, setActiveTab] = useState<string | null>(null)

  // Advancing is optimistic: the order moves lanes in the cache on tap and
  // the counts follow; the save runs behind it. If it fails, the order goes
  // back where it was with the reason on it. The mutation lives here, not in
  // the Chit, because the Chit unmounts the moment its order moves.
  const [leaving, setLeaving] = useState<Order[]>([])
  const [failed, setFailed] = useState<Record<string, string>>({})
  const advance = useMutation({
    mutationKey: ['advance'],
    mutationFn: ({ order, next }: Advance) => ordersApi.updateStatus(order.id, next),
    onMutate: ({ order, next }: Advance) => {
      setFailed(({ [order.id]: _, ...rest }) => rest)
      if (!REDUCED_MOTION) setLeaving(l => [...l, order])
      putInQueue(qc, { ...order, status: next })
    },
    onError: (err, { order }) => {
      putInQueue(qc, order)
      setFailed(f => ({ ...f, [order.id]: errorMessage(err) }))
    },
    // Reconcile with the server, after a failure too (a 409 can mean another
    // device moved it). Only once the LAST save in a burst settles: an
    // earlier one's refetch would bring back lanes the server hasn't caught
    // up on yet. A mutation still counts itself in onSettled, hence 1.
    onSettled: () => { if (qc.isMutating({ mutationKey: ['advance'] }) === 1) refreshOrders(qc) },
  })
  // A poll that lands mid-save would put the order back where the server
  // still has it, until the next one.
  const saving = useIsMutating({ mutationKey: ['advance'] }) > 0
  // An order whose move is still saving can't be moved again: it's already
  // in its new lane with a live button, and a second save could reach the
  // server first (handlers run in parallel), leaving it a step behind.
  const savingIds = useMutationState({
    filters: { mutationKey: ['advance'], status: 'pending' },
    select: m => (m.state.variables as Advance).order.id,
  })

  const { data: queue, isLoading, isError, refetch } = useQuery<Queue>({
    queryKey: keys.queue,
    queryFn: queueApi.getQueue,
    refetchInterval: saving ? false : 8_000,
    retry: 2,
  })

  // A lane: its orders plus any departing copies still sliding off it.
  const laneOrders = (lane: Lane) => {
    const live = (queue?.[lane] ?? []).map(order => ({ order, leaving: false }))
    const gone = leaving.filter(o => o.status === lane).map(order => ({ order, leaving: true }))
    return [...live, ...gone].sort((a, b) => new Date(a.order.created_at).getTime() - new Date(b.order.created_at).getTime())
  }
  const chit = ({ order, leaving: isLeaving }: { order: Order, leaving: boolean }, col: typeof COLS[number]) => isLeaving
    ? <Chit key={`leaving-${order.id}`} order={order} action={col.action} leaving
        onLeft={() => setLeaving(l => l.filter(o => o !== order))} />
    : <Chit key={order.id} order={order} action={col.action} error={failed[order.id]}
        saving={savingIds.includes(order.id)} onAdvance={() => advance.mutate({ order, next: col.next })} />

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
        <div className="wake-banner" style={{ padding: '8px 12px', marginBottom: 12, background: 'var(--s2)', border: '1px solid var(--border-hi)', borderRadius: 'var(--r)' }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--t2)', letterSpacing: '0.06em' }}>WAKING SERVER···</span>
        </div>
      )}

      {isError && (
        <div style={{ padding: '12px 16px', marginBottom: 12, background: 'color-mix(in srgb, var(--danger) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)', borderRadius: 'var(--r)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          const orders = laneOrders(col.key)
          return orders.length === 0 ? (
            <div style={{ border: '1px dashed var(--border)', borderRadius: 'var(--r)', padding: '48px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--t2)', letterSpacing: '0.06em' }}>
                NO {col.label.toUpperCase()} ORDERS
              </p>
            </div>
          ) : (
            orders.map(o => chit(o, col))
          )
        })()}
      </div>

      {/* ── Desktop: 3-col grid ── */}
      <div style={{ display: 'none' }} className="md-grid-3">
        {COLS.map(col => { const { key, label, dotClass, color } = col; return (
          <div key={key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${color}` }}>
              <div className={`dot ${dotClass}`} style={{ width: 5, height: 5 }} aria-hidden="true" />
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, color, letterSpacing: '0.1em' }}>{label.toUpperCase()}</span>
              <span className="data" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t2)' }}>{queue?.[key]?.length ?? 0}</span>
            </div>
            {laneOrders(key).length === 0 ? (
              <div style={{ border: '1px dashed var(--border)', borderRadius: 'var(--r)', padding: '28px 8px', textAlign: 'center' }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--t2)' }}>EMPTY</span>
              </div>
            ) : laneOrders(key).map(o => chit(o, col))}
          </div>
        )})}
      </div>
    </div>
  )
}
