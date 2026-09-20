import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { menuApi, ordersApi, BUSINESS_ID } from '../lib/api'
import { MenuItem, MenuData, CartItem, ModifierOption } from '../types'
import { ChevronLeft, X, Check, Minus, Plus, Trash2 } from 'lucide-react'

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
    <div role="dialog" aria-modal="true" aria-label={`Add ${item.name}`}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,16,12,0.92)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, background: 'var(--s1)', borderRadius: '16px 16px 0 0', maxHeight: '90vh', overflowY: 'auto', paddingBottom: 'env(safe-area-inset-bottom, 24px)', animation: 'pageEnter 0.28s cubic-bezier(.22,1,.36,1) both' }}>
        <div style={{ width: 32, height: 3, background: 'var(--s3)', borderRadius: 999, margin: '12px auto 0' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="display" style={{ fontSize: 24, color: 'var(--t1)' }}>{item.name.toUpperCase()}</p>
            <p className="data" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>
              ₱{(unit * qty).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="icon-btn" style={{ width: 36, height: 36 }}>
            <X size={13} aria-hidden="true" />
          </button>
        </div>

        <div style={{ padding: '14px 16px' }}>
          {mods.map(mod => (
            <div key={mod.id} style={{ marginBottom: 18 }}>
              <p className="label" style={{ marginBottom: 10 }}>
                {mod.name} {mod.is_required && <span style={{ color: 'var(--danger)' }}>*</span>}
              </p>
              <div role="group" aria-label={mod.name} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {mod.modifier_options.map(opt => {
                  const isSelected = sel[mod.id]?.id === opt.id
                  return (
                    <button key={opt.id} onClick={() => setSel(p => ({ ...p, [mod.id]: opt }))}
                      aria-pressed={isSelected}
                      className={`chip ${isSelected ? 'chip-on' : ''}`}
                      style={{ minHeight: 'var(--touch)' }}>
                      {isSelected && <Check size={10} aria-hidden="true" style={{ marginRight: 2 }} />}
                      {opt.name}
                      {opt.price_delta > 0 && <span style={{ opacity: 0.7 }}> +₱{opt.price_delta}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <div style={{ marginBottom: 18 }}>
            <label htmlFor="item-notes" className="label" style={{ display: 'block', marginBottom: 10 }}>Notes</label>
            <input id="item-notes" type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="less sugar, no ice…" className="field" />
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Decrease quantity" className="stepper-btn">
              <Minus size={16} aria-hidden="true" />
            </button>
            <span className="data" aria-live="polite" aria-label={`Quantity: ${qty}`}
              style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', minWidth: 32, textAlign: 'center' }}>
              {qty}
            </span>
            <button onClick={() => setQty(q => q + 1)} aria-label="Increase quantity" className="stepper-btn">
              <Plus size={16} aria-hidden="true" />
            </button>
            <button
              onClick={() => { if (canAdd) { onAdd({ menu_item_id: item.id, item_name: item.name, unit_price: unit, quantity: qty, notes, modifiers: Object.values(sel).map(o => ({ modifier_option_id: o.id, option_name: o.name, price_delta: o.price_delta })) }); onClose() } }}
              disabled={!canAdd}
              className="btn btn-fire"
              style={{ flex: 1, height: 'var(--touch)', fontSize: 13 }}>
              Add · ₱{(unit * qty).toLocaleString()}
            </button>
          </div>
          {!canAdd && mods.some(m => m.is_required) && (
            <p style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: 'var(--t3)', marginTop: 10, letterSpacing: '0.04em' }}>
              * SELECT REQUIRED OPTIONS TO CONTINUE
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function SuccessOverlay({ orderNumber, onDone }: { orderNumber: string, onDone: () => void }) {
  return (
    <div className="success-overlay" role="alertdialog" aria-label="Order placed">
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(0,232,135,0.12)', border: '2px solid var(--ready)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'checkPop 0.5s cubic-bezier(.34,1.56,.64,1) both' }}>
        <Check size={36} color="var(--ready)" strokeWidth={2.5} aria-hidden="true" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p className="display" style={{ fontSize: 40, color: 'var(--t1)', marginBottom: 8 }}>ORDER PLACED</p>
        <p className="data" style={{ fontSize: 22, color: 'var(--accent)', fontWeight: 700 }}>{orderNumber}</p>
        <p style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--t3)', marginTop: 10, letterSpacing: '0.08em' }}>
          ADDED TO QUEUE
        </p>
      </div>
      <button onClick={onDone} className="btn btn-fire" style={{ padding: '14px 40px', fontSize: 15, marginTop: 8 }}>
        View queue
      </button>
    </div>
  )
}

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
      items: cart.map(i => ({ menu_item_id: i.menu_item_id, item_name: i.item_name, unit_price: i.unit_price, quantity: i.quantity, notes: i.notes || null, modifiers: i.modifiers }))
    }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['orders', 'queue', 'stats'] })
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

  if (successOrder) return <SuccessOverlay orderNumber={successOrder} onDone={() => navigate('/queue')} />
  if (isLoading) return (
    <div style={{ padding: 14 }}>
      {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 76, marginBottom: 8 }} />)}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100svh - 110px)' }}>
      {/* Sub-header */}
      <div style={{ background: 'var(--s1)', borderBottom: '1px solid var(--border)', padding: '0 14px', height: 52, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => navigate(-1)} aria-label="Go back" style={{ color: 'var(--t2)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', padding: '10px 8px 10px 0' }}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className="display" style={{ fontSize: 22, color: 'var(--t1)', flex: 1 }}>NEW ORDER</span>
        {count > 0 && (
          <button onClick={() => setShowCart(true)} className="btn btn-fire" aria-label={`Cart: ${count} items`} style={{ padding: '7px 14px', fontSize: 11 }}>
            Cart · {count}
          </button>
        )}
      </div>

      {/* Source + name */}
      <div style={{ background: 'var(--s1)', borderBottom: '1px solid var(--border)', padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => setSrc('walk_in')} aria-pressed={src === 'walk_in'} className={`chip ${src === 'walk_in' ? 'chip-on' : ''}`}>Walk-in</button>
        <button onClick={() => setSrc('messenger')} aria-pressed={src === 'messenger'} className={`chip ${src === 'messenger' ? 'chip-on' : ''}`}>Messenger</button>
        <label htmlFor="cname" style={{ display: 'none' }}>Customer name</label>
        <input id="cname" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Customer name" className="field" style={{ flex: 1, padding: '8px 12px', fontSize: 12, borderRadius: 999, minHeight: 'var(--touch)' }} />
      </div>

      {/* Category tabs with sliding indicator */}
      <div className="scrollbar-none" role="tablist" aria-label="Menu categories"
        style={{ background: 'var(--s1)', borderBottom: '1px solid var(--border)', padding: '8px 14px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {cats.map(c => (
          <button key={c.id} onClick={() => setActiveCat(c.id)} role="tab" aria-selected={cat === c.id}
            className={`chip flex-shrink-0 ${cat === c.id ? 'chip-on' : ''}`}>
            {c.name}
          </button>
        ))}
      </div>

      {/* Menu grid */}
      <div role="tabpanel" style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {visible.map((item, idx) => (
            <button key={item.id} onClick={() => setSelItem(item)}
              className="panel menu-card"
              aria-label={`${item.name}, ₱${item.base_price}`}
              style={{ padding: '14px', textAlign: 'left', animation: `childEnter 0.3s ${idx * 30}ms both` }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', lineHeight: 1.3, marginBottom: 8 }}>{item.name}</p>
              <p className="data" style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>₱{item.base_price}</p>
              {item.menu_item_modifiers.length > 0 && (
                <p style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: 'var(--t3)', marginTop: 6, letterSpacing: '0.04em' }}>HAS OPTIONS</p>
              )}
            </button>
          ))}
          {!visible.length && (
            <p role="status" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--t3)' }}>
              NO ITEMS IN THIS CATEGORY
            </p>
          )}
        </div>
      </div>

      {/* Cart bar */}
      {count > 0 && !showCart && (
        <div style={{ background: 'var(--s1)', borderTop: '1px solid var(--border)', padding: '10px 14px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
          <button onClick={() => setShowCart(true)} className="btn btn-fire" style={{ width: '100%', padding: '14px', justifyContent: 'space-between', fontSize: 14 }}>
            <span className="data">{count} item{count !== 1 ? 's' : ''}</span>
            <span>₱{total.toLocaleString()} · Review</span>
          </button>
        </div>
      )}

      {selItem && menuData && (
        <ItemModal item={selItem} menuData={menuData} onAdd={i => setCart(p => [...p, i])} onClose={() => setSelItem(null)} />
      )}

      {showCart && (
        <div role="dialog" aria-modal="true" aria-label="Order summary"
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,16,12,0.92)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 480, background: 'var(--s1)', borderRadius: '16px 16px 0 0', maxHeight: '88vh', overflowY: 'auto', paddingBottom: 'env(safe-area-inset-bottom, 24px)', animation: 'pageEnter 0.28s cubic-bezier(.22,1,.36,1) both' }}>
            <div style={{ width: 32, height: 3, background: 'var(--s3)', borderRadius: 999, margin: '12px auto 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <span className="display" style={{ fontSize: 26, color: 'var(--t1)' }}>SUMMARY</span>
              <button onClick={() => setShowCart(false)} aria-label="Close" className="icon-btn" style={{ width: 36, height: 36 }}><X size={13} aria-hidden="true" /></button>
            </div>

            <div style={{ padding: '14px 16px' }}>
              <p className="label" style={{ marginBottom: 10 }}>Payment</p>
              <div role="group" aria-label="Payment method" style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                {['cash', 'gcash', 'card'].map(pm => (
                  <button key={pm} onClick={() => setPay(pm)} aria-pressed={pay === pm}
                    className={`chip flex-1 ${pay === pm ? 'chip-on' : ''}`} style={{ textTransform: 'capitalize', justifyContent: 'center' }}>
                    {pm}
                  </button>
                ))}
              </div>

              <div role="list" aria-label="Cart items">
                {cart.map((item, i) => (
                  <div key={i} role="listitem" style={{ display: 'flex', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{item.quantity}× {item.item_name}</p>
                      {item.modifiers.length > 0 && <p style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: 'var(--t3)', marginTop: 2 }}>{item.modifiers.map(m => m.option_name).join(' · ')}</p>}
                      {item.notes && <p style={{ fontSize: 10, color: 'var(--t2)', fontStyle: 'italic', marginTop: 2 }}>{item.notes}</p>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 12 }}>
                      <span className="data" style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>₱{(item.unit_price * item.quantity).toLocaleString()}</span>
                      <button onClick={() => setCart(p => p.filter((_, j) => j !== i))} aria-label={`Remove ${item.item_name}`}
                        style={{ width: 'var(--touch)', height: 'var(--touch)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', cursor: 'pointer', background: 'none', border: 'none' }}>
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '16px 0' }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--t3)', letterSpacing: '0.08em' }}>TOTAL</span>
                <span className="data" style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>₱{total.toLocaleString()}</span>
              </div>

              <button onClick={() => place.mutate()} disabled={place.isPending || !cart.length}
                className="btn btn-fire" style={{ width: '100%', padding: '16px', fontSize: 15 }}>
                {place.isPending ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(20,16,12,0.3)', borderTopColor: '#14100C', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                    Placing···
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
