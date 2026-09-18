import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { menuApi, ordersApi, BUSINESS_ID } from '../lib/api'
import { MenuItem, MenuData, CartItem, ModifierOption } from '../types'
import { Plus, Minus, Trash2, ChevronLeft, ShoppingCart, X } from 'lucide-react'

function ItemModal({ item, menuData, onAdd, onClose }: {
  item: MenuItem, menuData: MenuData,
  onAdd: (c: CartItem) => void, onClose: () => void
}) {
  const modifierIds = item.menu_item_modifiers.map(m => m.modifier_id)
  const modifiers = menuData.modifiers.filter(m => modifierIds.includes(m.id))
  const [selected, setSelected] = useState<Record<string, ModifierOption>>({})
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')

  const extraCost = Object.values(selected).reduce((s, o) => s + o.price_delta, 0)
  const unitPrice = item.base_price + extraCost
  const canAdd = modifiers.filter(m => m.is_required).every(m => selected[m.id])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', background: 'var(--surface)', padding: '20px 20px 32px', maxHeight: '88vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 999, margin: '0 auto 20px' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 className="font-display" style={{ fontSize: 22, color: 'var(--text)', lineHeight: 1.1 }}>{item.name}</h3>
            <p className="font-mono" style={{ fontSize: 16, color: 'var(--accent)', fontWeight: 700, marginTop: 4 }}>
              ₱{(unitPrice * qty).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
            <X size={13} />
          </button>
        </div>

        {/* Modifiers */}
        {modifiers.map(mod => (
          <div key={mod.id} style={{ marginBottom: 18 }}>
            <p className="section-label" style={{ marginBottom: 8 }}>
              {mod.name} {mod.is_required && <span style={{ color: 'var(--danger)' }}>*</span>}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {mod.modifier_options.map(opt => (
                <button key={opt.id}
                  onClick={() => setSelected(p => ({ ...p, [mod.id]: opt }))}
                  className={`pill ${selected[mod.id]?.id === opt.id ? 'pill-active' : ''}`}>
                  {opt.name}
                  {opt.price_delta > 0 && <span style={{ opacity: 0.7, marginLeft: 4 }}>+₱{opt.price_delta}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <p className="section-label" style={{ marginBottom: 8 }}>Notes</p>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. less sugar, extra ice…" className="input" />
        </div>

        {/* Qty + CTA */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: '8px 14px' }}>
            <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
              <Minus size={14} />
            </button>
            <span className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', minWidth: 16, textAlign: 'center' }}>{qty}</span>
            <button onClick={() => setQty(q => q + 1)} style={{ color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
              <Plus size={14} />
            </button>
          </div>
          <button onClick={() => { onAdd({ menu_item_id: item.id, item_name: item.name, unit_price: unitPrice, quantity: qty, notes, modifiers: Object.values(selected).map(o => ({ modifier_option_id: o.id, option_name: o.name, price_delta: o.price_delta })) }); onClose() }}
            disabled={!canAdd} className="btn btn-primary" style={{ flex: 1 }}>
            Add · ₱{(unitPrice * qty).toLocaleString()}
          </button>
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
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [showCart, setShowCart] = useState(false)
  const [source, setSource] = useState<'walk_in' | 'messenger'>('walk_in')

  const createOrder = useMutation({
    mutationFn: () => ordersApi.createOrder({
      business_id: BUSINESS_ID, source,
      customer_name: customerName || null,
      payment_method: paymentMethod,
      items: cart.map(i => ({ menu_item_id: i.menu_item_id, item_name: i.item_name, unit_price: i.unit_price, quantity: i.quantity, notes: i.notes || null, modifiers: i.modifiers }))
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['queue'] }); navigate('/queue') }
  })

  const cartTotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const categories = menuData?.categories ?? []
  const items = menuData?.items ?? []
  const activeCat = activeCategory ?? categories[0]?.id
  const visible = items.filter(i => i.category_id === activeCat && i.is_available)

  if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)', fontSize: 13 }}>Loading menu…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)' }}>

      {/* Sub-header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => navigate(-1)} style={{ color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="font-display" style={{ fontSize: 20, color: 'var(--text)', flex: 1 }}>New Order</h1>
        <button onClick={() => setShowCart(true)} style={{ position: 'relative', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
          <ShoppingCart size={20} />
          {cartCount > 0 && (
            <span className="font-mono" style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: 'var(--accent)', color: '#080503', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Source + name */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '8px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => setSource('walk_in')} className={`pill ${source === 'walk_in' ? 'pill-active' : ''}`}>Walk-in</button>
        <button onClick={() => setSource('messenger')} className={`pill ${source === 'messenger' ? 'pill-active' : ''}`}>Messenger</button>
        <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
          placeholder="Customer name" className="input" style={{ flex: 1, padding: '6px 12px', borderRadius: 999, fontSize: 12 }} />
      </div>

      {/* Category tabs */}
      <div className="scrollbar-none" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '8px 16px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {categories.map(cat => (
          <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
            className={`pill flex-shrink-0 ${activeCat === cat.id ? 'pill-active' : ''}`}>
            {cat.name}
          </button>
        ))}
      </div>

      {/* Menu items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {visible.map(item => (
            <button key={item.id} onClick={() => setSelectedItem(item)} className="card"
              style={{ padding: '12px 14px', textAlign: 'left', cursor: 'pointer', transition: 'opacity 0.12s', border: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-dim)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, marginBottom: 8 }}>{item.name}</p>
              <p className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>₱{item.base_price}</p>
              {item.menu_item_modifiers.length > 0 && (
                <p style={{ fontSize: 9, color: 'var(--text-faint)', marginTop: 4, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Has options</p>
              )}
            </button>
          ))}
          {visible.length === 0 && (
            <p style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'var(--text-muted)' }}>No items in this category</p>
          )}
        </div>
      </div>

      {/* Cart bar */}
      {cartCount > 0 && !showCart && (
        <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
          <button onClick={() => setShowCart(true)} className="btn btn-primary" style={{ width: '100%', justifyContent: 'space-between', padding: '12px 18px' }}>
            <span className="font-mono">{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
            <span>₱{cartTotal.toLocaleString()} · Review</span>
          </button>
        </div>
      )}

      {/* Item modal */}
      {selectedItem && menuData && (
        <ItemModal item={selectedItem} menuData={menuData}
          onAdd={item => setCart(p => [...p, item])}
          onClose={() => setSelectedItem(null)} />
      )}

      {/* Cart modal */}
      {showCart && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
          <div style={{ width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', background: 'var(--surface)', padding: '20px 20px 32px', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 999, margin: '0 auto 20px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="font-display" style={{ fontSize: 22, color: 'var(--text)' }}>Order summary</h3>
              <button onClick={() => setShowCart(false)} style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={13} />
              </button>
            </div>

            {/* Payment */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['cash', 'gcash', 'card'].map(pm => (
                <button key={pm} onClick={() => setPaymentMethod(pm)} className={`pill flex-1 capitalize ${paymentMethod === pm ? 'pill-active' : ''}`}>{pm}</button>
              ))}
            </div>

            {/* Items */}
            <div style={{ marginBottom: 16 }}>
              {cart.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.quantity}× {item.item_name}</p>
                    {item.modifiers.length > 0 && <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{item.modifiers.map(m => m.option_name).join(', ')}</p>}
                    {item.notes && <p style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2, fontStyle: 'italic' }}>{item.notes}</p>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 12, flexShrink: 0 }}>
                    <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>₱{(item.unit_price * item.quantity).toLocaleString()}</span>
                    <button onClick={() => setCart(p => p.filter((_, j) => j !== i))} style={{ color: 'var(--danger)', cursor: 'pointer', display: 'flex' }}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border)', marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Total</span>
              <span className="font-mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>₱{cartTotal.toLocaleString()}</span>
            </div>

            <button onClick={() => createOrder.mutate()} disabled={createOrder.isPending || cart.length === 0}
              className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: 15 }}>
              {createOrder.isPending ? 'Placing order…' : 'Place order'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
