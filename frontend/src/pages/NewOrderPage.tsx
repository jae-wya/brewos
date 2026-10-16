import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { menuApi, ordersApi, settingsApi, errorMessage } from '../lib/api'
import { MenuItem, MenuData, CartItem, ModifierOption } from '../types'
import OrderLine from '../components/orders/OrderLine'
import { keys, refreshOrders } from '../lib/queryKeys'
import { offeredItems, offeredModifiers } from '../lib/orderScreen'
import { fillTemplate, peso } from '../lib/composer'
import { ChevronLeft, X, Check, Minus, Plus, Trash2, Copy } from 'lucide-react'
import CategoryBar from '../components/CategoryBar'

const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const PAY_METHODS: [string, string][] = [['cash', 'Cash'], ['gcash', 'GCash'], ['maya', 'Maya'], ['card', 'Card']]

function ItemModal({ item, menuData, onAdd, onClose }: {
  item: MenuItem, menuData: MenuData,
  onAdd: (c: CartItem) => void, onClose: () => void
}) {
  // The shared menu has every add-on; offer only the ones that are on.
  const mods = offeredModifiers(item, menuData.modifiers)
  const [sel, setSel] = useState<Record<string, ModifierOption>>({})
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const extra = Object.values(sel).reduce((s, o) => s + o.price_delta, 0)
  const unit = item.base_price + extra
  const canAdd = mods.filter(m => m.is_required).every(m => sel[m.id])

  // Portalled to <body> at zIndex 110, like the Menu page's ItemSheet: at 60
  // the sticky header and nav (100) drew over it and Add sat against the nav.
  return createPortal(
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'color-mix(in srgb, var(--ink) 92%, transparent)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} data-board
        style={{
          width: '100%', maxWidth: 480,
          background: 'var(--s1)',
          borderRadius: '16px 16px 0 0',
          padding: '0 0 40px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}>

        {/* Drag handle */}
        <div style={{ width: 32, height: 3, background: 'var(--s3)', borderRadius: 999, margin: '12px auto 0' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="display" style={{ fontSize: 24, color: 'var(--t1)' }}>{item.name.toUpperCase()}</p>
            <p className="data" style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)', marginTop: 4 }}>
              &#8369;{(unit * qty).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="icon-btn" style={{ flexShrink: 0 }}>
            <X size={13} aria-hidden="true" />
          </button>
        </div>

        <div style={{ padding: '14px 16px' }}>
          {mods.map(mod => (
            <div key={mod.id} style={{ marginBottom: 18 }}>
              <p className="label" style={{ marginBottom: 10 }}>
                {mod.name} {mod.is_required && <span style={{ color: 'var(--danger)' }}>*</span>}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {mod.modifier_options.map(opt => {
                  const isSelected = sel[mod.id]?.id === opt.id
                  return (
                    <button key={opt.id} onClick={() => setSel(p => {
                        if (p[mod.id]?.id === opt.id) {
                          const next = { ...p }; delete next[mod.id]; return next
                        }
                        return { ...p, [mod.id]: opt }
                      })}
                      aria-pressed={isSelected}
                      className={`chip ${isSelected ? 'chip-on' : ''}`}>
                      {isSelected && <Check size={10} aria-hidden="true" style={{ marginRight: 2 }} />}
                      {opt.name}
                      {opt.price_delta > 0 && <span style={{ fontWeight: 500 }}> +&#8369;{opt.price_delta}</span>}
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

          {/* Stepper + Add — inline with content, pb-40 on wrapper ensures they're never hidden */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Decrease" className="stepper-btn">
              <Minus size={16} aria-hidden="true" />
            </button>
            <span className="data" aria-live="polite"
              style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', minWidth: 32, textAlign: 'center' }}>
              {qty}
            </span>
            <button onClick={() => setQty(q => q + 1)} aria-label="Increase" className="stepper-btn">
              <Plus size={16} aria-hidden="true" />
            </button>
            <button
              onClick={() => {
                if (canAdd) {
                  onAdd({
                    menu_item_id: item.id, item_name: item.name,
                    item_category: menuData.categories.find(c => c.id === item.category_id)?.name ?? null,
                    estimated_unit_price: unit, quantity: qty, notes,
                    modifiers: Object.values(sel).map(o => ({
                      modifier_option_id: o.id, option_name: o.name, price_delta: o.price_delta
                    }))
                  })
                  onClose()
                }
              }}
              disabled={!canAdd}
              className="btn btn-fire"
              style={{ flex: 1, height: 'var(--touch)', fontSize: 13 }}>
              Add · &#8369;{(unit * qty).toLocaleString()}
            </button>
          </div>
          {!canAdd && mods.some(m => m.is_required) && (
            <p style={{ fontSize: 12, color: 'var(--t2)', marginTop: 10 }}>
              Pick the options marked * to continue.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function SuccessOverlay({ orderNumber, onDone }: { orderNumber: string, onDone: () => void }) {
  return (
    <div className="success-overlay" role="alertdialog" aria-label="Order placed">
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'color-mix(in srgb, var(--ready) 12%, transparent)', border: '2px solid var(--ready)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'checkPop 0.5s cubic-bezier(.34,1.56,.64,1) both',
      }}>
        <Check size={36} color="var(--ready)" strokeWidth={2.5} aria-hidden="true" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p className="display" style={{ fontSize: 40, color: 'var(--t1)', marginBottom: 8 }}>ORDER PLACED</p>
        <p className="data" style={{ fontSize: 22, color: 'var(--accent)', fontWeight: 700 }}>{orderNumber}</p>
        <p style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--t2)', marginTop: 10, letterSpacing: '0.08em' }}>
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
  const { data: menuData, isLoading } = useQuery<MenuData>({ queryKey: keys.menu, queryFn: menuApi.getMenu })

  const [cart, setCart] = useState<CartItem[]>([])
  const [selItem, setSelItem] = useState<MenuItem | null>(null)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [pay, setPay] = useState('cash')
  const [showCart, setShowCart] = useState(false)
  const [src, setSrc] = useState<'walk_in' | 'messenger'>('walk_in')
  // "Paid now": on for Messenger (paid by GCash proof before she makes it),
  // off for walk-in, where counting it paid before the money arrives would
  // be an accounting error and drop it off her unpaid list. Switching the
  // source goes back to that source's default.
  const [paidChoice, setPaidChoice] = useState<boolean | null>(null)
  const paid = paidChoice ?? src === 'messenger'
  const pickSource = (s: 'walk_in' | 'messenger') => { setSrc(s); setPaidChoice(null) }
  // Messenger only: when they'll pick it up, in her words ("3pm", "in an
  // hour or two"). Saved as the order's notes, shown on the queue.
  const [pickup, setPickup] = useState('')
  const [sent, setSent] = useState(false)
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null)
  const { data: settings } = useQuery({ queryKey: keys.settings, queryFn: settingsApi.get, staleTime: 5 * 60_000 })
  const [successOrder, setSuccessOrder] = useState<string | null>(null)

  const place = useMutation({
    mutationFn: () => ordersApi.createOrder({
      source: src,
      customer_name: name || null, payment_method: pay, paid,
      notes: src === 'messenger' && pickup.trim() ? `Pickup: ${pickup.trim()}` : null,
      // Only IDs and quantities — the backend looks up prices and names
      items: cart.map(i => ({
        menu_item_id: i.menu_item_id, quantity: i.quantity,
        notes: i.notes || null,
        modifiers: i.modifiers.map(m => ({ modifier_option_id: m.modifier_option_id }))
      }))
    }),
    onSuccess: (data) => {
      // The chit she just wrote lifts off toward the queue first (skipped,
      // with no wait, under reduced motion).
      setSent(true)
      setTimeout(() => {
        setSent(false)
        refreshOrders(qc)
        setShowCart(false)
        setSuccessOrder(data.order_number)
      }, REDUCED_MOTION ? 0 : 340)
    }
  })

  const total = cart.reduce((s, i) => s + i.estimated_unit_price * i.quantity, 0)

  // The payment request she sends mid-thread, before the customer pays,
  // filled from the cart. Total is the cart's: live menu prices, the same
  // the server charges — never anything typed into the thread.
  const message = () => fillTemplate(settings?.messenger_template ?? '', {
    lines: cart.map(i => ({
      quantity: i.quantity, name: i.item_name, category: i.item_category,
      // Name the category only for Hot/Iced twins, where the customer needs it.
      showCategory: (menuData?.items.filter(m => m.name === i.item_name).length ?? 0) > 1,
      modifiers: i.modifiers.map(m => m.option_name),
      lineTotal: i.estimated_unit_price * i.quantity,
    })),
    total, pickup, name, gcash: settings?.gcash_number ?? '', maya: settings?.maya_number ?? '',
  })
  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message())
      setCopied('yes')
      setTimeout(() => setCopied(c => c === 'yes' ? null : c), 2500)
    } catch {
      setCopied('failed') // show the text so she can long-press copy it
    }
  }
  const count = cart.reduce((s, i) => s + i.quantity, 0)
  const cats = menuData?.categories ?? []
  const items = menuData?.items ?? []
  const cat = activeCat ?? cats[0]?.id
  // Same menu as the Menu page, so it's never behind her edits. Hide what's
  // off (including a switch still saving) and any new item that doesn't have
  // its real id yet — an order can't reference a placeholder.
  const visible = offeredItems(items, cat)

  if (successOrder) return <SuccessOverlay orderNumber={successOrder} onDone={() => navigate('/queue')} />
  if (isLoading) return (
    <div style={{ padding: 14 }}>
      {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 76, marginBottom: 8 }} />)}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100svh - 110px)' }}>
      {/* Sub-header */}
      <div style={{ background: 'var(--s1)', borderBottom: '1px solid var(--border)', padding: '0 14px', height: 52, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={() => navigate(-1)} aria-label="Go back"
          style={{ color: 'var(--t2)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, marginLeft: -12, flexShrink: 0 }}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className="display" style={{ fontSize: 26, color: 'var(--t1)', flex: 1, letterSpacing: '0.03em' }}>NEW ORDER</span>
        {count > 0 && (
          <button onClick={() => setShowCart(true)} className="btn btn-fire"
            aria-label={`Cart: ${count} items`} style={{ padding: '7px 14px', fontSize: 11 }}>
            Cart · {count}
          </button>
        )}
      </div>

      {/* Source + name */}
      <div style={{ background: 'var(--s1)', borderBottom: '1px solid var(--border)', padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <button onClick={() => pickSource('walk_in')} aria-pressed={src === 'walk_in'} className={`chip ${src === 'walk_in' ? 'chip-on' : ''}`}>Walk-in</button>
        <button onClick={() => pickSource('messenger')} aria-pressed={src === 'messenger'} className={`chip ${src === 'messenger' ? 'chip-on' : ''}`}>Messenger</button>
        <label htmlFor="cname" style={{ display: 'none' }}>Customer name</label>
        <input id="cname" type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Customer name" className="field"
          style={{ flex: 1, padding: '8px 12px', fontSize: 12, borderRadius: 999, minHeight: 'var(--touch)' }} />
      </div>

      {/* Menu grid */}
      <div role="tabpanel" data-board style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {visible.map((item, idx) => (
            <button key={item.id} onClick={() => setSelItem(item)}
              className="panel menu-card"
              aria-label={`${item.name}`}
              style={{ padding: '14px', textAlign: 'left', animation: `childEnter 0.3s ${idx * 30}ms both` }}>
              <p className="display" style={{ fontSize: 22, color: 'var(--t1)', lineHeight: 1, letterSpacing: '0.02em', marginBottom: 8 }}>{item.name}</p>
              <p className="data" style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>&#8369;{item.base_price}</p>
            </button>
          ))}
          {!visible.length && (
            <p role="status" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--t2)' }}>
              NO ITEMS IN THIS CATEGORY
            </p>
          )}
        </div>
      </div>

      {/* Category tabs, pinned just above the cart bar: she switches
          category constantly, one-handed, so they sit where the thumb is. */}
      <div data-board style={{ flexShrink: 0 }}>
        <CategoryBar kind="tabs" label="Menu categories" cats={cats} active={cat} onPick={setActiveCat} />
      </div>

      {/* Cart bar */}
      {count > 0 && !showCart && (
        <div style={{ background: 'var(--s1)', borderTop: '1px solid var(--border)', padding: '10px 14px', flexShrink: 0 }}>
          <button onClick={() => setShowCart(true)} className="btn btn-fire"
            style={{ width: '100%', padding: '14px', justifyContent: 'space-between', fontSize: 14 }}>
            <span className="data">{count} item{count !== 1 ? 's' : ''}</span>
            <span>{peso(total)} · Review</span>
          </button>
        </div>
      )}

      {selItem && menuData && (
        <ItemModal item={selItem} menuData={menuData}
          onAdd={i => setCart(p => [...p, i])} onClose={() => setSelItem(null)} />
      )}

      {/* Cart sheet. Portalled at zIndex 110 like ItemSheet: at 60 the nav (100)
          drew over its bottom and Place order sat flush against it. */}
      {showCart && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Order summary"
          style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(20,16,12,0.92)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{
            width: '100%', maxWidth: 480,
            background: 'var(--s1)',
            borderRadius: '16px 16px 0 0',
            padding: '0 0 40px',
            maxHeight: '90vh',
            overflowY: 'auto',
            animation: 'pageEnter 0.28s cubic-bezier(.22,1,.36,1) both',
          }}>
            <div style={{ width: 32, height: 3, background: 'var(--s3)', borderRadius: 999, margin: '12px auto 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <span className="display" style={{ fontSize: 26, color: 'var(--t1)' }}>SUMMARY</span>
              <button onClick={() => setShowCart(false)} aria-label="Close" className="icon-btn">
                <X size={13} aria-hidden="true" />
              </button>
            </div>

            <div style={{ padding: '14px 16px' }}>
              {/* The chit she's writing: the same paper slip that will hang on
                  the queue's rail. */}
              <div className="chit" style={{ padding: '14px 14px 12px', marginBottom: 20, animation: sent ? 'chitSend 0.34s ease-in forwards' : undefined }}>
                <p className="display" style={{ fontSize: 22, color: 'var(--ink)', lineHeight: 1 }}>
                  New · {src === 'messenger' ? 'Messenger' : 'Walk-in'}{name.trim() ? ` · ${name.trim()}` : ''}
                </p>
                {cart.map((item, i) => (
                  <OrderLine key={i} variant="chit"
                    quantity={item.quantity} name={item.item_name} category={null}
                    modifiers={[...(item.item_category ? [item.item_category] : []), ...item.modifiers.map(m => m.option_name)]} notes={item.notes || null}
                    trailing={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8, alignSelf: 'center' }}>
                      <span className="data" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                        {peso(item.estimated_unit_price * item.quantity)}
                      </span>
                      <button onClick={() => { place.reset(); setCart(p => p.filter((_, j) => j !== i)) }}
                        aria-label={`Remove ${item.item_category ?? ''} ${item.item_name}`.trim()}
                        style={{ width: 'var(--touch)', height: 'var(--touch)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)', cursor: 'pointer', background: 'none', border: 'none', marginRight: -10 }}>
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  } />
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 12, borderTop: '1px dashed color-mix(in srgb, var(--ink) 30%, transparent)', marginTop: 4 }}>
                  <span className="data" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', letterSpacing: '0.08em' }}>TOTAL</span>
                  <span className="display" style={{ fontSize: 40, color: 'var(--ink)', lineHeight: 0.9 }}>{peso(total)}</span>
                </div>
              </div>

              <p className="label" style={{ marginBottom: 10 }}>Payment</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                {PAY_METHODS.map(([pm, label]) => (
                  <button key={pm} onClick={() => setPay(pm)} aria-pressed={pay === pm}
                    className={`chip flex-1 ${pay === pm ? 'chip-on' : ''}`}
                    style={{ justifyContent: 'center', padding: '7px 6px' }}>
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', minHeight: 'var(--touch)', marginBottom: 18 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Paid now</p>
                  <p style={{ fontSize: 12, color: 'var(--t2)', marginTop: 1 }}>
                    {paid ? 'Counts as a sale today' : 'Mark it paid later, on Orders'}
                  </p>
                </div>
                <button onClick={() => setPaidChoice(!paid)} role="switch" aria-checked={paid}
                  aria-label="Paid now" className={`tog ${paid ? 'tog-on' : 'tog-off'}`} style={{ marginLeft: 16 }}>
                  <span className="tog-knob" />
                </button>
              </div>

              {src === 'messenger' && (
                <div style={{ marginBottom: 14 }}>
                  <label htmlFor="pickup" className="label" style={{ display: 'block', marginBottom: 8 }}>Pickup</label>
                  <input id="pickup" type="text" value={pickup} onChange={e => setPickup(e.target.value)}
                    placeholder="3pm, in an hour…" className="field" autoComplete="off" />
                </div>
              )}

              {src === 'messenger' && (
                <div style={{ marginBottom: 12 }}>
                  <button onClick={copyMessage} disabled={!cart.length || !settings}
                    className="btn btn-ghost" style={{ width: '100%', minHeight: 'var(--touch)', fontSize: 13 }}>
                    {copied === 'yes' ? <><Check size={14} aria-hidden="true" /> Copied — paste it in Messenger</>
                      : <><Copy size={14} aria-hidden="true" /> Copy payment message</>}
                  </button>
                  {copied === 'failed' && (
                    <div style={{ marginTop: 8 }}>
                      <p role="alert" style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 6 }}>
                        Couldn't copy automatically. Press and hold the text to copy it.
                      </p>
                      <textarea readOnly value={message()} rows={8} className="field" style={{ fontSize: 12 }}
                        onFocus={e => e.currentTarget.select()} />
                    </div>
                  )}
                </div>
              )}

              {/* The server's sentence, e.g. which item was deleted from the menu */}
              {place.isError && (
                <p role="alert" style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>
                  {errorMessage(place.error)}
                </p>
              )}

              <button onClick={() => place.mutate()} disabled={place.isPending || !cart.length}
                className="btn btn-fire" style={{ width: '100%', padding: '16px', fontSize: 15 }}>
                {place.isPending ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid color-mix(in srgb, var(--on-kraft) 30%, transparent)', borderTopColor: 'var(--on-kraft)', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                    Placing···
                  </span>
                ) : 'Place order'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
