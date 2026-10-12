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
  // 'queue' makes the category prominent — she reads it while making the
  // drink, and Hot vs Iced Spanish Latte are different drinks — as bold
  // uppercase text, not a pill: a bordered pill looked like a button.
  // 'record' (Orders page, cart) keeps it as a quiet .label.
  variant?: 'queue' | 'record'
  trailing?: ReactNode
}) {
  const queue = variant === 'queue'
  const showSubline = (!queue && category) || modifiers.length > 0

  return (
    <div className="kds-row">
      <span className="data" style={{ fontSize: queue ? 14 : 12, fontWeight: 700, color: 'var(--t1)', flexShrink: 0, minWidth: 20, lineHeight: 1.4 }}>
        {quantity}×
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: queue ? 14 : 13, fontWeight: 600, color: 'var(--t1)', lineHeight: 1.3 }}>{name}</p>
        {showSubline && (
          <p style={{ marginTop: 2, lineHeight: 1.4 }}>
            {!queue && category && <span className="label">{category}</span>}
            {!queue && category && modifiers.length > 0 && (
              <span style={{ color: 'var(--t2)', fontSize: 11 }}> · </span>
            )}
            {modifiers.length > 0 && (
              // Add-ons are part of the drink (Medium, an extra shot): readable at
              // a glance, not fine print.
              <span style={{ fontSize: queue ? 12 : 11, fontWeight: queue ? 600 : 500, color: 'var(--t2)' }}>
                {modifiers.join(' · ')}
              </span>
            )}
          </p>
        )}
        {notes && <p style={{ fontSize: 12, color: 'var(--t2)', fontStyle: 'italic', marginTop: 2 }}>{notes}</p>}
      </div>
      {queue && category && (
        <span className="data" style={{ flexShrink: 0, marginLeft: 8, paddingTop: 2, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--t1)', textAlign: 'right', maxWidth: 110 }}>
          {category}
        </span>
      )}
      {trailing}
    </div>
  )
}
