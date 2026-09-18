import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { menuApi, ordersApi, BUSINESS_ID } from '../lib/api'
import { MenuItem, MenuData, CartItem, ModifierOption } from '../types'
import { Plus, Minus, Trash2, ChevronLeft, ShoppingCart, X } from 'lucide-react'

function ItemModal({ item, menuData, onAdd, onClose }: {
  item: MenuItem, menuData: MenuData,
  onAdd: (cartItem: CartItem) => void, onClose: () => void
}) {
  const itemModifierIds = item.menu_item_modifiers.map(m => m.modifier_id)
  const itemModifiers = menuData.modifiers.filter(m => itemModifierIds.includes(m.id))
  const [selectedOptions, setSelectedOptions] = useState<Record<string, ModifierOption>>({})
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')

  const totalPrice = item.base_price +
    Object.values(selectedOptions).reduce((sum, opt) => sum + opt.price_delta, 0)

  const canAdd = itemModifiers.filter(m => m.is_required).every(m => selectedOptions[m.id])

  const handleAdd = () => {
    onAdd({
      menu_item_id: item.id,
      item_name: item.name,
      unit_price: totalPrice,
      quantity,
      notes,
      modifiers: Object.values(selectedOptions).map(opt => ({
        modifier_option_id: opt.id,
        option_name: opt.name,
        price_delta: opt.price_delta,
      }))
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl p-5 pb-10 max-h-[85vh] overflow-y-auto"
        style={{ background: 'var(--surface)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-display text-xl" style={{ color: 'var(--text)' }}>{item.name}</h3>
            <p className="font-mono font-bold mt-0.5" style={{ color: 'var(--accent)' }}>
              ₱{totalPrice * quantity}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            <X size={15} />
          </button>
        </div>

        {/* Modifiers */}
        {itemModifiers.map(modifier => (
          <div key={modifier.id} className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: 'var(--text-faint)' }}>
              {modifier.name}
              {modifier.is_required && <span style={{ color: 'var(--danger)' }}> *</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {modifier.modifier_options.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedOptions(prev => ({ ...prev, [modifier.id]: opt }))}
                  className={`pill ${selectedOptions[modifier.id]?.id === opt.id ? 'pill-active' : ''}`}
                >
                  {opt.name}
                  {opt.price_delta > 0 && (
                    <span className="ml-1 opacity-70">+₱{opt.price_delta}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Notes */}
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: 'var(--text-faint)' }}>Notes</p>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. less sugar, extra hot…"
            className="input"
          />
        </div>

        {/* Qty + Add */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-3 rounded-full px-3 py-2"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
              style={{ color: 'var(--text-muted)' }}>
              <Minus size={14} />
            </button>
            <span className="font-mono font-bold w-4 text-center" style={{ color: 'var(--text)' }}>
              {quantity}
            </span>
            <button onClick={() => setQuantity(q => q + 1)}
              style={{ color: 'var(--text-muted)' }}>
              <Plus size={14} />
            </button>
          </div>
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="btn btn-primary flex-1"
          >
            Add to order · ₱{(totalPrice * quantity).toLocaleString()}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NewOrderPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: menuData, isLoading } = useQuery<MenuData>({
    queryKey: ['menu'],
    queryFn: menuApi.getMenu,
  })

  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [showCart, setShowCart] = useState(false)
  const [source, setSource] = useState<'walk_in' | 'messenger'>('walk_in')

  const createOrder = useMutation({
    mutationFn: () => ordersApi.createOrder({
      business_id: BUSINESS_ID,
      source,
      customer_name: customerName || null,
      payment_method: paymentMethod,
      items: cart.map(item => ({
        menu_item_id: item.menu_item_id,
        item_name: item.item_name,
        unit_price: item.unit_price,
        quantity: item.quantity,
        notes: item.notes || null,
        modifiers: item.modifiers,
      }))
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['queue'] })
      navigate('/queue')
    }
  })

  const cartTotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  if (isLoading) return (
    <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>
      Loading menu…
    </div>
  )

  const categories = menuData?.categories ?? []
  const items = menuData?.items ?? []
  const activeCategory = activeCategoryId ?? categories[0]?.id
  const visibleItems = items.filter(i => i.category_id === activeCategory && i.is_available)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 112px)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        className="px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="font-display text-xl flex-1" style={{ color: 'var(--text)' }}>New Order</h1>
        <button onClick={() => setShowCart(true)} className="relative p-2" style={{ color: 'var(--text-muted)' }}>
          <ShoppingCart size={20} />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-xs flex items-center justify-center font-mono"
              style={{ background: 'var(--accent)', color: '#0F0A06' }}>
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Source + customer */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        className="px-4 py-2 flex gap-2">
        {(['walk_in', 'messenger'] as const).map(s => (
          <button key={s}
            onClick={() => setSource(s)}
            className={`pill text-xs ${source === s ? 'pill-active' : ''}`}>
            {s === 'walk_in' ? 'Walk-in' : 'Messenger'}
          </button>
        ))}
        <input
          type="text"
          value={customerName}
          onChange={e => setCustomerName(e.target.value)}
          placeholder="Customer name"
          className="input text-xs py-1.5 flex-1"
          style={{ borderRadius: 999 }}
        />
      </div>

      {/* Category tabs */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        className="flex overflow-x-auto gap-2 px-4 py-2 scrollbar-none">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategoryId(cat.id)}
            className={`pill flex-shrink-0 ${activeCategory === cat.id ? 'pill-active' : ''}`}>
            {cat.name}
          </button>
        ))}
      </div>

      {/* Menu grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          {visibleItems.map(item => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="card p-3 text-left hover:opacity-80 transition-opacity active:scale-95"
              style={{ transition: 'transform 0.1s, opacity 0.15s' }}
            >
              <p className="text-sm font-semibold leading-tight mb-2" style={{ color: 'var(--text)' }}>
                {item.name}
              </p>
              <p className="font-mono font-bold text-sm" style={{ color: 'var(--accent)' }}>
                ₱{item.base_price}
              </p>
              {item.menu_item_modifiers.length > 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>Has options</p>
              )}
            </button>
          ))}
          {visibleItems.length === 0 && (
            <p className="col-span-2 text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
              No items in this category
            </p>
          )}
        </div>
      </div>

      {/* Cart bar */}
      {cart.length > 0 && !showCart && (
        <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
          className="px-4 py-3">
          <button onClick={() => setShowCart(true)} className="btn btn-primary w-full justify-between">
            <span className="font-mono">{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
            <span>₱{cartTotal.toLocaleString()} · Review order</span>
          </button>
        </div>
      )}

      {/* Item modal */}
      {selectedItem && menuData && (
        <ItemModal
          item={selectedItem}
          menuData={menuData}
          onAdd={item => setCart(prev => [...prev, item])}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {/* Cart modal */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-lg rounded-t-2xl p-5 pb-10 max-h-[85vh] overflow-y-auto"
            style={{ background: 'var(--surface)' }}>

            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl" style={{ color: 'var(--text)' }}>Order summary</h3>
              <button onClick={() => setShowCart(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                <X size={15} />
              </button>
            </div>

            {/* Payment */}
            <div className="flex gap-2 mb-4">
              {['cash', 'gcash', 'card'].map(pm => (
                <button key={pm}
                  onClick={() => setPaymentMethod(pm)}
                  className={`pill flex-1 capitalize ${paymentMethod === pm ? 'pill-active' : ''}`}>
                  {pm}
                </button>
              ))}
            </div>

            {/* Items */}
            <div className="space-y-2 mb-4">
              {cart.map((item, i) => (
                <div key={i} className="flex items-start justify-between rounded-xl p-3"
                  style={{ background: 'var(--surface-2)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      {item.quantity}× {item.item_name}
                    </p>
                    {item.modifiers.length > 0 && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {item.modifiers.map(m => m.option_name).join(', ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-xs mt-0.5 italic" style={{ color: 'var(--text-faint)' }}>
                        {item.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <span className="font-mono font-bold text-sm" style={{ color: 'var(--text)' }}>
                      ₱{(item.unit_price * item.quantity).toLocaleString()}
                    </span>
                    <button onClick={() => setCart(prev => prev.filter((_, j) => j !== i))}
                      style={{ color: 'var(--danger)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between py-3 mb-4"
              style={{ borderTop: '1px solid var(--border)' }}>
              <span className="font-semibold" style={{ color: 'var(--text)' }}>Total</span>
              <span className="font-mono font-bold text-xl" style={{ color: 'var(--accent)' }}>
                ₱{cartTotal.toLocaleString()}
              </span>
            </div>

            <button
              onClick={() => createOrder.mutate()}
              disabled={createOrder.isPending || cart.length === 0}
              className="btn btn-primary w-full py-3 text-base"
            >
              {createOrder.isPending ? 'Placing order…' : 'Place order'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
