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
  // 'chit' is the Queue: ink on her paper slip, item names in Bebas Neue
  // like a hand-lettered sign, readable at arm's length mid-drink; the
  // category prominent (Hot vs Iced Spanish Latte are different drinks) as
  // bold text, not a pill, which looked like a button.
  // 'record' (Orders page, cart) is the quiet version on the dark counter.
  variant?: 'chit' | 'record'
  trailing?: ReactNode
}) {
  const chit = variant === 'chit'
  const showSubline = (!chit && category) || modifiers.length > 0
  const strong = chit ? 'var(--ink)' : 'var(--t1)'
  const soft = chit ? 'var(--ink-2)' : 'var(--t2)'

  return (
    <div className="kds-row" style={chit ? { borderBottomColor: 'color-mix(in srgb, var(--ink) 14%, transparent)', alignItems: 'baseline' } : undefined}>
      <span className={chit ? 'display' : 'data'} style={{ fontSize: chit ? 22 : 12, fontWeight: 700, color: strong, flexShrink: 0, minWidth: chit ? 26 : 20, lineHeight: chit ? 1 : 1.4 }}>
        {quantity}×
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className={chit ? 'display' : undefined} style={chit
          ? { fontSize: 22, color: strong, lineHeight: 1, letterSpacing: '0.02em' }
          : { fontSize: 13, fontWeight: 600, color: strong, lineHeight: 1.3 }}>{name}</p>
        {showSubline && (
          <p style={{ marginTop: 2, lineHeight: 1.4 }}>
            {!chit && category && <span className="label">{category}</span>}
            {!chit && category && modifiers.length > 0 && (
              <span style={{ color: soft, fontSize: 11 }}> · </span>
            )}
            {modifiers.length > 0 && (
              // Add-ons are part of the drink (Medium, an extra shot): readable at
              // a glance, not fine print.
              <span style={{ fontSize: chit ? 13 : 11, fontWeight: chit ? 600 : 500, color: soft }}>
                {modifiers.join(' · ')}
              </span>
            )}
          </p>
        )}
        {notes && <p style={{ fontSize: chit ? 13 : 12, color: soft, fontStyle: 'italic', marginTop: 2 }}>{notes}</p>}
      </div>
      {chit && category && (
        <span className="data" style={{ flexShrink: 0, marginLeft: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: strong, textAlign: 'right', maxWidth: 110 }}>
          {category}
        </span>
      )}
      {trailing}
    </div>
  )
}
