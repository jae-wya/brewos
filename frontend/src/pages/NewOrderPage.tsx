import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { menuApi, ordersApi, BUSINESS_ID } from '../lib/api'
import { MenuItem, MenuData, CartItem, ModifierOption } from '../types'
import { Plus, Minus, Trash2, ChevronLeft, X } from 'lucide-react'

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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'var(--s1)', borderRadius: '12px 12px 0 0', padding: '0 0 32px', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 16px 14px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="type-display" style={{ fontSize: 18, color: 'var(--t1)', lineHeight: 1.1 }}>{item.name}</p>
            <p className="type-data" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>
              ₱{(unit * qty).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} style={{ width: 26, height: 26, background: 'var(--s3)', border: 'none', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--t2)', flexShrink: 0 }}>
            <X size={12} />
          </button>
        </div>

        <div style={{ padding: '14px 16px' }}>
          {mods.map(mod => (
            <div key={mod.id} style={{ marginBottom: 16 }}>
              <p className="type-label" style={{ marginBottom: 8 }}>
                {mod.name} {mod.is_required && <span style={{ color: 'var(--danger)' }}>*</span>}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {mod.modifier_options.map(opt => (
                  <button key={opt.id} onClick={() => setSel(p => ({ ...p, [mod.id]: opt }))}
                    className={`chip ${sel[mod.id]?.id === opt.id ? 'chip-on' : ''}`}>
                    {opt.name}{opt.price_delta > 0 && <span style={{ opacity: 0.6 }}> +₱{opt.price_delta}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div style={{ marginBottom: 16 }}>
            <p className="type-label" style={{ marginBottom: 8 }}>Notes</p>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="less sugar, no ice…" className="field" />
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 999, padding: '6px 14px' }}>
              <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ color: 'var(--t2)', cursor: 'pointer', display: 'flex', background: 'none', border: 'none' }}><Minus size={13} /></button>
              <span className="type-data" style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', minWidth: 16, textAlign: 'center' }}>{qty}</span>
              <button onClick={() => setQty(q => q + 1)} style={{ color: 'var(--t2)', cursor: 'pointer', display: 'flex', background: 'none', border: 'none' }}><Plus size={13} /></button>
            </div>
            <button onClick={() => { onAdd({ menu_item_id: item.id, item_name: item.name, unit_price: unit, quantity: qty, notes, modifiers: Object.values(sel).map(o => ({ modifier_option_id: o.id, option_name: o.name, price_delta: o.price_delta })) }); onClose() }}
              disabled={!canAdd} className="btn btn-accent" style={{ flex: 1, padding: '10px' }}>
              Add · ₱{(unit * qty).toLocaleString()}
            </button>
          </div>
        </div>
      </div>
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

  const place = useMutation({
    mutationFn: () => ordersApi.createOrder({
      business_id: BUSINESS_ID, source: src,
      customer_name: name || null, payment_method: pay,
      items: cart.map(i => ({ menu_item_id: i.menu_item_id, item_name: i.item_name, unit_price: i.unit_price, quantity: i.quantity, notes: i.notes || null, modifiers: i.modifiers }))
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders', 'queue'] }); navigate('/queue') }
  })

  const total = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const count = cart.reduce((s, i) => s + i.quantity, 0)
  const cats = menuData?.categories ?? []
  const items = menuData?.items ?? []
  const cat = activeCat ?? cats[0]?.id
  const visible = items.filter(i => i.category_id === cat && i.is_available)

  if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--t3)' }}>LOADING···</span></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 110px)' }}>

      {/* Sub-header */}
      <div style={{ background: 'var(--s1)', borderBottom: '1px solid var(--border)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => navigate(-1)} style={{ color: 'var(--t2)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex' }}><ChevronLeft size={18} /></button>
        <span className="type-display" style={{ fontSize: 18, color: 'var(--t1)', flex: 1 }}>New order</span>
        {count > 0 && (
          <button onClick={() => setShowCart(true)} className="btn btn-accent" style={{ padding: '6px 14px', fontSize: 11 }}>
            Cart · {count}
          </button>
        )}
      </div>

      {/* Source + name */}
      <div style={{ background: 'var(--s1)', borderBottom: '1px solid var(--border)', padding: '8px 14px', display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={() => setSrc('walk_in')} className={`chip ${src === 'walk_in' ? 'chip-on' : ''}`}>Walk-in</button>
        <button onClick={() => setSrc('messenger')} className={`chip ${src === 'messenger' ? 'chip-on' : ''}`}>Messenger</button>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Customer name" className="field" style={{ flex: 1, padding: '6px 10px', fontSize: 12, borderRadius: 999 }} />
      </div>

      {/* Category tabs */}
      <div className="scrollbar-none" style={{ background: 'var(--s1)', borderBottom: '1px solid var(--border)', padding: '8px 14px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {cats.map(c => (
          <button key={c.id} onClick={() => setActiveCat(c.id)} className={`chip flex-shrink-0 ${cat === c.id ? 'chip-on' : ''}`}>{c.name}</button>
        ))}
      </div>

      {/* Menu grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {visible.map(item => (
            <button key={item.id} onClick={() => setSelItem(item)} className="panel"
              style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-lo)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', lineHeight: 1.3, marginBottom: 6 }}>{item.name}</p>
              <p className="type-data" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>₱{item.base_price}</p>
              {item.menu_item_modifiers.length > 0 && (
                <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--t3)', marginTop: 4, letterSpacing: '0.04em' }}>HAS OPTIONS</p>
              )}
            </button>
          ))}
          {!visible.length && <p style={{ gridColumn: '1/-1', textAlign: 'center', padding: '32px 0', fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--t3)' }}>NO ITEMS</p>}
        </div>
      </div>

      {/* Bottom bar */}
      {count > 0 && !showCart && (
        <div style={{ background: 'var(--s1)', borderTop: '1px solid var(--border)', padding: '10px 14px' }}>
          <button onClick={() => setShowCart(true)} className="btn btn-accent" style={{ width: '100%', padding: '12px', justifyContent: 'space-between', fontSize: 13 }}>
            <span className="type-data">{count} item{count !== 1 ? 's' : ''}</span>
            <span>₱{total.toLocaleString()} · Review</span>
          </button>
        </div>
      )}

      {selItem && menuData && (
        <ItemModal item={selItem} menuData={menuData} onAdd={i => setCart(p => [...p, i])} onClose={() => setSelItem(null)} />
      )}

      {showCart && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 480, background: 'var(--s1)', borderRadius: '12px 12px 0 0', padding: '0 0 32px', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <span className="type-display" style={{ fontSize: 20, color: 'var(--t1)' }}>Summary</span>
              <button onClick={() => setShowCart(false)} style={{ width: 26, height: 26, background: 'var(--s3)', border: 'none', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--t2)' }}><X size={12} /></button>
            </div>

            <div style={{ padding: '12px 16px' }}>
              {/* Payment */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {['cash', 'gcash', 'card'].map(pm => (
                  <button key={pm} onClick={() => setPay(pm)} className={`chip flex-1 capitalize ${pay === pm ? 'chip-on' : ''}`}>{pm}</button>
                ))}
              </div>

              {/* Items */}
              {cart.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{item.quantity}× {item.item_name}</p>
                    {item.modifiers.length > 0 && <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--t3)', marginTop: 2 }}>{item.modifiers.map(m => m.option_name).join(' · ')}</p>}
                    {item.notes && <p style={{ fontSize: 10, color: 'var(--t2)', fontStyle: 'italic', marginTop: 2 }}>{item.notes}</p>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="type-data" style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>₱{(item.unit_price * item.quantity).toLocaleString()}</span>
                    <button onClick={() => setCart(p => p.filter((_, j) => j !== i))} style={{ color: 'var(--danger)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex' }}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}

              {/* Total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0 16px' }}>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--t3)', letterSpacing: '0.06em' }}>TOTAL</span>
                <span className="type-data" style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>₱{total.toLocaleString()}</span>
              </div>

              <button onClick={() => place.mutate()} disabled={place.isPending || !cart.length}
                className="btn btn-accent" style={{ width: '100%', padding: '13px', fontSize: 14 }}>
                {place.isPending ? 'Placing···' : 'Place order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
