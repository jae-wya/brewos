import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { menuApi, ordersApi, BUSINESS_ID } from '../lib/api'
import { MenuItem, MenuData, CartItem, ModifierOption } from '../types'
import { ChevronLeft, X, Check, Minus, Plus, Trash2 } from 'lucide-react'

// ── Item modal ──
function ItemModal({ item, menuData, onAdd, onClose }: {
  item: MenuItem, menuData: MenuData,
  onAdd: (c: CartItem) => void, onClose: () => void
}) {
  const modIds = item.menu_item_modifiers.map(m => m.modifier_id)
  const mods = menuData.modifiers.filter(m => modIds.includes(m.id))
  const [sel, setSel] = useState<Record<string, ModifierOption>>({})
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const extra = Object.values(sel).reduce((s, o) => s + o.price_delta, 0)
  const unit = item.base_price + extra
  const canAdd = mods.filter(m => m.is_required).every(m => sel[m.id])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Add ${item.name} to order`}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'var(--s1)', borderRadius: '12px 12px 0 0', maxHeight: '90vh', overflowY: 'auto', paddingBottom: 'env(safe-area-inset-bottom, 24px)' }}>
        {/* Drag handle */}
        <div style={{ width: 32, height: 3, background: 'var(--s3)', borderRadius: 999, margin: '12px auto 0' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="type-display" style={{ fontSize: 18, color: 'var(--t1)', lineHeight: 1.1 }}>{item.name}</p>
            <p className="type-data" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>
              ₱{(unit * qty).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="icon-btn" style={{ width: 36, height: 36 }}>
            <X size={13} aria-hidden="true" />
          </button>
        </div>

        <div style={{ padding: '14px 16px' }}>
          {mods.map(mod => (
            <div key={mod.id} style={{ marginBottom: 16 }}>
              <p className="type-label" style={{ marginBottom: 10 }}>
                {mod.name} {mod.is_required && <span style={{ color: 'var(--danger)' }} aria-label="required">*</span>}
              </p>
              <div role="group" aria-label={mod.name} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {mod.modifier_options.map(opt => {
                  const isSelected = sel[mod.id]?.id === opt.id
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setSel(p => ({ ...p, [mod.id]: opt }))}
                      aria-pressed={isSelected}
                      className={`chip ${isSelected ? 'chip-on' : ''}`}
                      style={{ minHeight: 'var(--touch)' }}
                    >
                      {isSelected && <Check size={10} aria-hidden="true" />}
                      {opt.name}
                      {opt.price_delta > 0 && <span style={{ opacity: 0.7 }}> +₱{opt.price_delta}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="item-notes" className="type-label" style={{ display: 'block', marginBottom: 8 }}>Notes</label>
            <input
              id="item-notes"
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="less sugar, no ice…"
              className="field"
            />
          </div>

          {/* Stepper — large touch targets */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 2 }}>
            <button
              onClick={() => setQty(q => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
              className="stepper-btn"
            >
              <Minus size={16} aria-hidden="true" />
            </button>
            <span
              className="type-data"
              aria-live="polite"
              aria-label={`Quantity: ${qty}`}
              style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', minWidth: 32, textAlign: 'center' }}
            >
              {qty}
            </span>
            <button
              onClick={() => setQty(q => q + 1)}
              aria-label="Increase quantity"
              className="stepper-btn"
            >
              <Plus size={16} aria-hidden="true" />
            </button>
            <button
              onClick={() => {
                if (canAdd) {
                  onAdd({ menu_item_id: item.id, item_name: item.name, unit_price: unit, quantity: qty, notes, modifiers: Object.values(sel).map(o => ({ modifier_option_id: o.id, option_name: o.name, price_delta: o.price_delta })) })
                  onClose()
                }
              }}
              disabled={!canAdd}
              className="btn btn-accent"
              style={{ flex: 1, padding: '0 16px', height: 'var(--touch)', fontSize: 13 }}
            >
              Add · ₱{(unit * qty).toLocaleString()}
            </button>
          </div>
          {!canAdd && mods.some(m => m.is_required) && (
            <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--t3)', marginTop: 8, letterSpacing: '0.04em' }}>
              * SELECT REQUIRED OPTIONS TO CONTINUE
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Success overlay ──
function SuccessOverlay({ orderNumber, onDone }: { orderNumber: string, onDone: () => void }) {
  return (
    <div className="success-overlay" role="alertdialog" aria-label="Order placed successfully">
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,232,135,0.15)', border: '2px solid var(--ready)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Check size={28} color="var(--ready)" strokeWidth={2.5} aria-hidden="true" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p className="type-display" style={{ fontSize: 24, color: 'var(--t1)', marginBottom: 6 }}>Order placed</p>
        <p className="type-data" style={{ fontSize: 18, color: 'var(--accent)', fontWeight: 700 }}>{orderNumber}</p>
        <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--t3)', marginTop: 8, letterSpacing: '0.06em' }}>
          ADDED TO QUEUE
        </p>
      </div>
      <button onClick={onDone} className="btn btn-accent" style={{ padding: '12px 32px', fontSize: 14, marginTop: 8 }}>
        View queue
      </button>
    </div>
  )
}

// ── Main page ──
export default function NewOrderPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: menuData, isLoading } = useQuery<MenuData>({ queryKey: ['menu'], queryFn: menuApi.getMenu })

  const [cart, setCart] = useState<CartItem[]>([])
  const [selItem, setSelItem] = useState<MenuItem | null>(null)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [pay, setPay] = useState('cash')
  const [showCart, setShowCart] = useState(false)
  const [src, setSrc] = useState<'walk_in' | 'messenger'>('walk_in')
  const [successOrder, setSuccessOrder] = useState<string | null>(null)

  const place = useMutation({
    mutationFn: () => ordersApi.createOrder({
      business_id: BUSINESS_ID, source: src,
      customer_name: name || null, payment_method: pay,
      items: cart.map(i => ({
        menu_item_id: i.menu_item_id, item_name: i.item_name,
        unit_price: i.unit_price, quantity: i.quantity,
        notes: i.notes || null, modifiers: i.modifiers
      }))
    }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['queue'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      setShowCart(false)
      setSuccessOrder(data.order_number)
    }
  })

  const total = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const count = cart.reduce((s, i) => s + i.quantity, 0)
  const cats = menuData?.categories ?? []
  const items = menuData?.items ?? []
  const cat = activeCat ?? cats[0]?.id
  const visible = items.filter(i => i.category_id === cat && i.is_available)

  // Success overlay
  if (successOrder) {
    return <SuccessOverlay orderNumber={successOrder} onDone={() => navigate('/queue')} />
  }

  if (isLoading) return (
    <div style={{ padding: 16 }}>
      {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 72, marginBottom: 8 }} />)}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100svh - 110px)' }}>

      {/* Sub-header */}
      <div style={{ background: 'var(--s1)', borderBottom: '1px solid var(--border)', padding: '0 14px', height: 52, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => navigate(-1)} aria-label="Go back" style={{ color: 'var(--t2)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', padding: '10px 8px 10px 0' }}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className="type-display" style={{ fontSize: 18, color: 'var(--t1)', flex: 1 }}>New order</span>
        {count > 0 && (
          <button
            onClick={() => setShowCart(true)}
            className="btn btn-accent"
            aria-label={`View cart, ${count} items, total ₱${total}`}
            style={{ padding: '7px 14px', fontSize: 11 }}
          >
            Cart · {count}
          </button>
        )}
      </div>

      {/* Source + name */}
      <div style={{ background: 'var(--s1)', borderBottom: '1px solid var(--border)', padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => setSrc('walk_in')} aria-pressed={src === 'walk_in'} className={`chip ${src === 'walk_in' ? 'chip-on' : ''}`}>Walk-in</button>
        <button onClick={() => setSrc('messenger')} aria-pressed={src === 'messenger'} className={`chip ${src === 'messenger' ? 'chip-on' : ''}`}>Messenger</button>
        <label htmlFor="customer-name" style={{ display: 'none' }}>Customer name</label>
        <input id="customer-name" type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Customer name" className="field"
          style={{ flex: 1, padding: '8px 12px', fontSize: 12, borderRadius: 999, minHeight: 'var(--touch)' }} />
      </div>

      {/* Category tabs */}
      <div className="scrollbar-none" style={{ background: 'var(--s1)', borderBottom: '1px solid var(--border)', padding: '8px 14px', display: 'flex', gap: 6, overflowX: 'auto' }}
        role="tablist" aria-label="Menu categories">
        {cats.map(c => (
          <button key={c.id} onClick={() => setActiveCat(c.id)}
            role="tab"
            aria-selected={cat === c.id}
            className={`chip flex-shrink-0 ${cat === c.id ? 'chip-on' : ''}`}>
            {c.name}
          </button>
        ))}
      </div>

      {/* Menu grid */}
      <div role="tabpanel" style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {visible.map(item => (
            <button
              key={item.id}
              onClick={() => setSelItem(item)}
              className="panel"
              aria-label={`${item.name}, ₱${item.base_price}${item.menu_item_modifiers.length > 0 ? ', has options' : ''}`}
              style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.1s', minHeight: 80 }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', lineHeight: 1.3, marginBottom: 6 }}>{item.name}</p>
              <p className="type-data" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>₱{item.base_price}</p>
              {item.menu_item_modifiers.length > 0 && (
                <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--t3)', marginTop: 4, letterSpacing: '0.04em' }}>HAS OPTIONS</p>
              )}
            </button>
          ))}
          {!visible.length && (
            <p role="status" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '32px 0', fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--t3)' }}>
              NO ITEMS IN THIS CATEGORY
            </p>
          )}
        </div>
      </div>

      {/* Bottom cart bar */}
      {count > 0 && !showCart && (
        <div style={{ background: 'var(--s1)', borderTop: '1px solid var(--border)', padding: '10px 14px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
          <button onClick={() => setShowCart(true)} className="btn btn-accent"
            aria-label={`Review order: ${count} items, ₱${total}`}
            style={{ width: '100%', padding: '13px', justifyContent: 'space-between', fontSize: 14 }}>
            <span className="type-data">{count} item{count !== 1 ? 's' : ''}</span>
            <span>₱{total.toLocaleString()} · Review</span>
          </button>
        </div>
      )}

      {/* Item modal */}
      {selItem && menuData && (
        <ItemModal item={selItem} menuData={menuData}
          onAdd={i => setCart(p => [...p, i])}
          onClose={() => setSelItem(null)} />
      )}

      {/* Cart sheet */}
      {showCart && (
        <div role="dialog" aria-modal="true" aria-label="Order summary"
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 480, background: 'var(--s1)', borderRadius: '12px 12px 0 0', maxHeight: '88vh', overflowY: 'auto', paddingBottom: 'env(safe-area-inset-bottom, 24px)' }}>
            <div style={{ width: 32, height: 3, background: 'var(--s3)', borderRadius: 999, margin: '12px auto 0' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <span className="type-display" style={{ fontSize: 20, color: 'var(--t1)' }}>Summary</span>
              <button onClick={() => setShowCart(false)} aria-label="Close cart" className="icon-btn" style={{ width: 36, height: 36 }}>
                <X size={13} aria-hidden="true" />
              </button>
            </div>

            <div style={{ padding: '12px 16px' }}>
              {/* Payment method */}
              <p className="type-label" style={{ marginBottom: 8 }}>Payment</p>
              <div role="group" aria-label="Payment method" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {['cash', 'gcash', 'card'].map(pm => (
                  <button key={pm} onClick={() => setPay(pm)}
                    aria-pressed={pay === pm}
                    className={`chip flex-1 ${pay === pm ? 'chip-on' : ''}`}
                    style={{ textTransform: 'capitalize' }}>
                    {pm}
                  </button>
                ))}
              </div>

              {/* Cart items */}
              <div role="list" aria-label="Cart items">
                {cart.map((item, i) => (
                  <div key={i} role="listitem" style={{ display: 'flex', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{item.quantity}× {item.item_name}</p>
                      {item.modifiers.length > 0 && (
                        <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--t3)', marginTop: 2 }}>
                          {item.modifiers.map(m => m.option_name).join(' · ')}
                        </p>
                      )}
                      {item.notes && <p style={{ fontSize: 10, color: 'var(--t2)', fontStyle: 'italic', marginTop: 2 }}>{item.notes}</p>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 12 }}>
                      <span className="type-data" style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>
                        ₱{(item.unit_price * item.quantity).toLocaleString()}
                      </span>
                      <button
                        onClick={() => setCart(p => p.filter((_, j) => j !== i))}
                        aria-label={`Remove ${item.item_name} from cart`}
                        style={{ width: 'var(--touch)', height: 'var(--touch)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', cursor: 'pointer', background: 'none', border: 'none', margin: '-10px -10px -10px 0' }}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0 16px' }}>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--t3)', letterSpacing: '0.06em' }}>TOTAL</span>
                <span className="type-data" style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)' }}>₱{total.toLocaleString()}</span>
              </div>

              <button
                onClick={() => place.mutate()}
                disabled={place.isPending || !cart.length}
                className="btn btn-accent"
                aria-label={place.isPending ? 'Placing order' : `Place order for ₱${total}`}
                style={{ width: '100%', padding: '14px', fontSize: 15 }}
              >
                {place.isPending ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #14141488', borderTopColor: '#141414', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                    Placing order···
                  </span>
                ) : 'Place order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
