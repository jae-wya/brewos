import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { menuApi, ordersApi, BUSINESS_ID } from '../lib/api'
import { MenuItem, MenuData, CartItem, ModifierOption } from '../types'
import { Plus, Minus, Trash2, ChevronLeft, ShoppingCart } from 'lucide-react'
import clsx from 'clsx'

// Item modal for selecting modifiers
function ItemModal({
  item,
  menuData,
  onAdd,
  onClose,
}: {
  item: MenuItem
  menuData: MenuData
  onAdd: (cartItem: CartItem) => void
  onClose: () => void
}) {
  const itemModifierIds = item.menu_item_modifiers.map(m => m.modifier_id)
  const itemModifiers = menuData.modifiers.filter(m => itemModifierIds.includes(m.id))

  const [selectedOptions, setSelectedOptions] = useState<Record<string, ModifierOption>>({})
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')

  const totalPrice = item.base_price +
    Object.values(selectedOptions).reduce((sum, opt) => sum + opt.price_delta, 0)

  const handleSelect = (modifierId: string, option: ModifierOption) => {
    setSelectedOptions(prev => ({ ...prev, [modifierId]: option }))
  }

  const canAdd = itemModifiers
    .filter(m => m.is_required)
    .every(m => selectedOptions[m.id])

  const handleAdd = () => {
    onAdd({
      menu_item_id: item.id,
      item_name: item.name,
      unit_price: totalPrice,
      quantity,
      notes,
      modifiers: Object.entries(selectedOptions).map(([, opt]) => ({
        modifier_option_id: opt.id,
        option_name: opt.name,
        price_delta: opt.price_delta,
      }))
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-roast-800 rounded-t-2xl w-full max-w-lg p-5 pb-16 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-display font-bold text-brew-100 text-lg">{item.name}</h3>
            <p className="text-brew-400 font-semibold">₱{item.base_price}</p>
          </div>
          <button onClick={onClose} className="text-roast-400 hover:text-brew-300 text-2xl leading-none">×</button>
        </div>

        {itemModifiers.map(modifier => (
          <div key={modifier.id} className="mb-4">
            <p className="text-xs font-semibold text-roast-400 uppercase tracking-wider mb-2">
              {modifier.name} {modifier.is_required && <span className="text-red-400">*</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {modifier.modifier_options.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => handleSelect(modifier.id, opt)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                    selectedOptions[modifier.id]?.id === opt.id
                      ? 'bg-brew-500 border-brew-400 text-white'
                      : 'bg-roast-700 border-roast-600 text-brew-200 hover:border-brew-500'
                  )}
                >
                  {opt.name}
                  {opt.price_delta > 0 && <span className="text-xs ml-1">+₱{opt.price_delta}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="mb-4">
          <p className="text-xs font-semibold text-roast-400 uppercase tracking-wider mb-2">Notes</p>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. less sugar, extra hot..."
            className="w-full bg-roast-700 border border-roast-600 rounded-lg px-3 py-2 text-sm text-brew-100 placeholder-roast-500 focus:outline-none focus:border-brew-500"
          />
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="w-8 h-8 bg-roast-700 rounded-lg flex items-center justify-center text-brew-200 hover:bg-roast-600"
            >
              <Minus size={14} />
            </button>
            <span className="text-brew-100 font-bold w-4 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(q => q + 1)}
              className="w-8 h-8 bg-roast-700 rounded-lg flex items-center justify-center text-brew-200 hover:bg-roast-600"
            >
              <Plus size={14} />
            </button>
          </div>
          <span className="font-bold text-brew-300 text-lg">₱{(totalPrice * quantity).toLocaleString()}</span>
        </div>

        <button
          onClick={handleAdd}
          disabled={!canAdd}
          className={clsx('w-full btn-primary', !canAdd && 'opacity-50 cursor-not-allowed')}
        >
          Add to Order
        </button>
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

  const addToCart = (item: CartItem) => {
    setCart(prev => [...prev, item])
  }

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index))
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 text-roast-500">
      Loading menu...
    </div>
  )

  const categories = menuData?.categories ?? []
  const items = menuData?.items ?? []

  const activeCategory = activeCategoryId ?? categories[0]?.id
  const visibleItems = items.filter(item =>
    item.category_id === activeCategory && item.is_available
  )

  return (
    <div className="flex flex-col h-[calc(100vh-112px)]">
      {/* Header */}
      <div className="bg-roast-800 border-b border-roast-700 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-roast-400 hover:text-brew-300">
          <ChevronLeft size={20} />
        </button>
        <h1 className="font-display font-bold text-brew-100 flex-1">New Order</h1>
        <button
          onClick={() => setShowCart(true)}
          className="relative p-2 text-roast-400 hover:text-brew-300"
        >
          <ShoppingCart size={20} />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-brew-500 rounded-full text-white text-xs flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Source + customer */}
      <div className="px-4 py-3 bg-roast-800 border-b border-roast-700 flex gap-2">
        <button
          onClick={() => setSource('walk_in')}
          className={clsx('flex-1 text-xs py-1.5 rounded-lg border transition-colors',
            source === 'walk_in'
              ? 'bg-brew-500 border-brew-400 text-white'
              : 'bg-roast-700 border-roast-600 text-roast-400'
          )}
        >
          Walk-in
        </button>
        <button
          onClick={() => setSource('messenger')}
          className={clsx('flex-1 text-xs py-1.5 rounded-lg border transition-colors',
            source === 'messenger'
              ? 'bg-brew-500 border-brew-400 text-white'
              : 'bg-roast-700 border-roast-600 text-roast-400'
          )}
        >
          Messenger
        </button>
        <input
          type="text"
          value={customerName}
          onChange={e => setCustomerName(e.target.value)}
          placeholder="Customer name (optional)"
          className="flex-[2] bg-roast-700 border border-roast-600 rounded-lg px-3 text-xs text-brew-100 placeholder-roast-500 focus:outline-none focus:border-brew-500"
        />
      </div>

      {/* Category tabs */}
      <div className="flex overflow-x-auto gap-2 px-4 py-2 bg-roast-800 border-b border-roast-700 scrollbar-none">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategoryId(cat.id)}
            className={clsx(
              'whitespace-nowrap text-xs px-3 py-1.5 rounded-full border transition-colors flex-shrink-0',
              activeCategory === cat.id
                ? 'bg-brew-500 border-brew-400 text-white'
                : 'bg-roast-700 border-roast-600 text-roast-400 hover:border-brew-500'
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Menu items */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          {visibleItems.map(item => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="card p-3 text-left hover:border-brew-500 transition-colors active:scale-95"
            >
              <p className="text-sm font-semibold text-brew-100 leading-tight mb-1">{item.name}</p>
              <p className="text-brew-400 font-bold">₱{item.base_price}</p>
              {item.menu_item_modifiers.length > 0 && (
                <p className="text-roast-500 text-xs mt-1">Has options</p>
              )}
            </button>
          ))}
          {visibleItems.length === 0 && (
            <p className="text-roast-500 text-sm col-span-2 text-center py-16">
              No items in this category
            </p>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      {cart.length > 0 && !showCart && (
        <div className="px-4 py-3 bg-roast-800 border-t border-roast-700">
          <button
            onClick={() => setShowCart(true)}
            className="w-full btn-primary flex items-center justify-between"
          >
            <span>{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
            <span>₱{cartTotal.toLocaleString()} — Review Order</span>
          </button>
        </div>
      )}

      {/* Item modal */}
      {selectedItem && menuData && (
        <ItemModal
          item={selectedItem}
          menuData={menuData}
          onAdd={addToCart}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {/* Cart modal */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
          <div className="bg-roast-800 rounded-t-2xl w-full max-w-lg p-5 pb-16 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-brew-100 text-lg">Order Summary</h3>
              <button onClick={() => setShowCart(false)} className="text-roast-400 hover:text-brew-300 text-2xl leading-none">×</button>
            </div>

            {/* Payment method */}
            <div className="flex gap-2 mb-4">
              {['cash', 'gcash', 'card'].map(pm => (
                <button
                  key={pm}
                  onClick={() => setPaymentMethod(pm)}
                  className={clsx(
                    'flex-1 text-xs py-1.5 rounded-lg border capitalize transition-colors',
                    paymentMethod === pm
                      ? 'bg-brew-500 border-brew-400 text-white'
                      : 'bg-roast-700 border-roast-600 text-roast-400'
                  )}
                >
                  {pm}
                </button>
              ))}
            </div>

            {/* Cart items */}
            <div className="space-y-2 mb-4">
              {cart.map((item, i) => (
                <div key={i} className="flex items-start justify-between bg-roast-700 rounded-lg p-3">
                  <div className="flex-1">
                    <p className="text-sm text-brew-100 font-semibold">
                      {item.quantity}× {item.item_name}
                    </p>
                    {item.modifiers.length > 0 && (
                      <p className="text-xs text-roast-400">
                        {item.modifiers.map(m => m.option_name).join(', ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-xs text-roast-500 italic">{item.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-brew-300 font-bold text-sm">
                      ₱{(item.unit_price * item.quantity).toLocaleString()}
                    </span>
                    <button
                      onClick={() => removeFromCart(i)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mb-4 pt-2 border-t border-roast-700">
              <span className="font-bold text-brew-100">Total</span>
              <span className="font-bold text-brew-300 text-xl">₱{cartTotal.toLocaleString()}</span>
            </div>

            <button
              onClick={() => createOrder.mutate()}
              disabled={createOrder.isPending || cart.length === 0}
              className="w-full btn-primary text-base py-3"
            >
              {createOrder.isPending ? 'Placing Order...' : 'Place Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
