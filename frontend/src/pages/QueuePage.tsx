import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queueApi, ordersApi } from '../lib/api'
import { Order } from '../types'
import { Clock, Flame, CheckCheck, RefreshCw } from 'lucide-react'
import clsx from 'clsx'

const COLUMNS = [
  { key: 'pending',  label: 'Pending',  icon: Clock,      next: 'brewing',   action: 'Start Brewing', color: 'text-amber-400',  border: 'border-amber-500/30' },
  { key: 'brewing',  label: 'Brewing',  icon: Flame,      next: 'ready',     action: 'Mark Ready',    color: 'text-blue-400',   border: 'border-blue-500/30' },
  { key: 'ready',    label: 'Ready',    icon: CheckCheck, next: 'picked_up', action: 'Picked Up',     color: 'text-green-400',  border: 'border-green-500/30' },
]

function OrderCard({ order, nextStatus, actionLabel }: {
  order: Order
  nextStatus: string
  actionLabel: string
}) {
  const qc = useQueryClient()
  const advance = useMutation({
    mutationFn: () => ordersApi.updateStatus(order.id, nextStatus),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queue'] })
  })

  return (
    <div className="card p-3 mb-2">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-bold text-brew-200 text-sm">{order.order_number}</p>
          {order.customer_name && (
            <p className="text-roast-400 text-xs">{order.customer_name}</p>
          )}
        </div>
        <span className="text-xs text-roast-500">
          {new Date(order.created_at).toLocaleTimeString('en-PH', {
            hour: '2-digit', minute: '2-digit'
          })}
        </span>
      </div>

      <div className="mb-3 space-y-1">
        {order.order_items.map((item, i) => (
          <div key={i} className="text-xs text-brew-100">
            <span className="text-roast-400">{item.quantity}×</span> {item.item_name}
            {item.order_item_modifiers.length > 0 && (
              <span className="text-roast-500"> ({item.order_item_modifiers.map(m => m.option_name).join(', ')})</span>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => advance.mutate()}
        disabled={advance.isPending}
        className="w-full btn-primary text-xs py-1.5"
      >
        {advance.isPending ? '...' : actionLabel}
      </button>
    </div>
  )
}

export default function QueuePage() {
  const qc = useQueryClient()
  const { data: queue, isLoading } = useQuery({
    queryKey: ['queue'],
    queryFn: queueApi.getQueue,
    refetchInterval: 10_000,
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 text-roast-500">
      Loading queue...
    </div>
  )

  const total = COLUMNS.reduce((sum, col) => sum + (queue?.[col.key]?.length ?? 0), 0)

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-xl font-bold text-brew-100">Live Queue</h1>
          <p className="text-roast-400 text-xs">{total} active order{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['queue'] })}
          className="p-2 text-roast-400 hover:text-brew-300 transition-colors"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {COLUMNS.map(({ key, label, icon: Icon, next, action, color, border }) => (
          <div key={key}>
            <div className={clsx('flex items-center gap-1.5 mb-2 pb-2 border-b', border)}>
              <Icon size={14} className={color} />
              <span className={clsx('text-xs font-semibold', color)}>{label}</span>
              <span className="ml-auto text-xs text-roast-500">
                {queue?.[key]?.length ?? 0}
              </span>
            </div>
            {queue?.[key]?.length === 0 && (
              <p className="text-roast-600 text-xs text-center py-4">Empty</p>
            )}
            {queue?.[key]?.map((order: Order) => (
              <OrderCard
                key={order.id}
                order={order}
                nextStatus={next}
                actionLabel={action}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
