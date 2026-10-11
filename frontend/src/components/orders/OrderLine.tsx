import { ReactNode } from 'react'

// One order line — used by the Queue cards, the Orders page and the
// new-order cart so all three show the same thing.
//
// `category` comes from the order_items.item_category snapshot (in the cart,
// from the item being added). Never look it up from the live menu here.
export default function OrderLine({
  quantity, name, category, modifiers, notes, variant = 'record', trailing,
}: {
  quantity: number
  name: string
  category: string | null
  modifiers: string[]
  notes: string | null
  // 'queue' gives the category a .chip — she reads it while making the drink.
  // 'record' (Orders page, cart) keeps it as a quiet .label.
  variant?: 'queue' | 'record'
  trailing?: ReactNode
}) {
  const queue = variant === 'queue'
  const showSubline = (!queue && category) || modifiers.length > 0

  return (
    <div className="kds-row">
      <span className="data" style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0, minWidth: 16, lineHeight: 1.6 }}>
        {quantity}×
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: queue ? 12 : 13, fontWeight: 600, color: 'var(--t1)', lineHeight: 1.3 }}>{name}</p>
        {showSubline && (
          <p style={{ marginTop: 2, lineHeight: 1.4 }}>
            {!queue && category && <span className="label">{category}</span>}
            {!queue && category && modifiers.length > 0 && (
              <span style={{ color: 'var(--t3)', fontSize: 9 }}> · </span>
            )}
            {modifiers.length > 0 && (
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: queue ? 8 : 9, color: 'var(--t3)' }}>
                {modifiers.join(' · ')}
              </span>
            )}
          </p>
        )}
        {notes && <p style={{ fontSize: 10, color: 'var(--t2)', fontStyle: 'italic', marginTop: 2 }}>{notes}</p>}
      </div>
      {queue && category && (
        <span className="chip" style={{ flexShrink: 0, cursor: 'default' }}>{category}</span>
      )}
      {trailing}
    </div>
  )
}
