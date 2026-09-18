import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queueApi, ordersApi } from '../lib/api'
import { Order } from '../types'
import { Clock, Flame, CheckCheck, RefreshCw } from 'lucide-react'

const COLUMNS = [
  { key: 'pending', label: 'Pending', icon: Clock,      next: 'brewing',   action: 'Start Brewing', stripeClass: 'queue-col-pending', iconColor: 'var(--pending)' },
  { key: 'brewing', label: 'Brewing', icon: Flame,      next: 'ready',     action: 'Mark Ready',    stripeClass: 'queue-col-brewing', iconColor: 'var(--brewing)' },
  { key: 'ready',   label: 'Ready',   icon: CheckCheck, next: 'picked_up', action: 'Picked Up ✓',   stripeClass: 'queue-col-ready',   iconColor: 'var(--ready)'   },
]

function OrderCard({ order, nextStatus, actionLabel, stripeClass }: {
  order: Order, nextStatus: string, actionLabel: string, stripeClass: string
}) {
  const qc = useQueryClient()
  const advance = useMutation({
    mutationFn: () => ordersApi.updateStatus(order.id, nextStatus),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queue'] })
  })

  return (
    <div className={`card mb-2 overflow-hidden ${stripeClass}`} style={{ paddingLeft: 12 }}>
      <div className="p-3">
        <div className="flex items-start justify-between mb-2">
          <span className="font-mono font-bold text-sm" style={{ color: 'var(--accent)' }}>
            {order.order_number}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {new Date(order.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {order.customer_name && (
          <p className="text-xs mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>
            {order.customer_name}
          </p>
        )}

        <div className="mb-3 space-y-1">
          {order.order_items.map((item, i) => (
            <div key={i} className="text-xs" style={{ color: 'var(--text)' }}>
              <span style={{ color: 'var(--text-muted)' }}>{item.quantity}×</span> {item.item_name}
              {item.order_item_modifiers.length > 0 && (
                <span style={{ color: 'var(--text-faint)' }}>
                  {' '}({item.order_item_modifiers.map(m => m.option_name).join(', ')})
                </span>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => advance.mutate()}
          disabled={advance.isPending}
          className="btn btn-primary w-full text-xs py-2"
        >
          {advance.isPending ? '···' : actionLabel}
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
    <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>
      Loading queue…
    </div>
  )

  const total = COLUMNS.reduce((sum, col) => sum + (queue?.[col.key]?.length ?? 0), 0)

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-2xl" style={{ color: 'var(--text)' }}>Live Queue</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {total} active order{total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['queue'] })}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {COLUMNS.map(({ key, label, icon: Icon, next, action, stripeClass, iconColor }) => (
          <div key={key}>
            {/* Column header */}
            <div className="flex items-center gap-1.5 mb-3">
              <Icon size={13} style={{ color: iconColor }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: iconColor }}>
                {label}
              </span>
              <span className="ml-auto font-mono text-xs" style={{ color: 'var(--text-faint)' }}>
                {queue?.[key]?.length ?? 0}
              </span>
            </div>

            {queue?.[key]?.length === 0 && (
              <div className="card p-4 text-center" style={{ borderStyle: 'dashed' }}>
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Empty</p>
              </div>
            )}

            {queue?.[key]?.map((order: Order) => (
              <OrderCard
                key={order.id}
                order={order}
                nextStatus={next}
                actionLabel={action}
                stripeClass={stripeClass}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
