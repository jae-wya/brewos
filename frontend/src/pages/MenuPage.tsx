import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { menuApi, errorMessage, ItemFields } from '../lib/api'
import { keys } from '../lib/queryKeys'
import { putItem, putOptimistic, removeItem, settleItem, nextSortOrder, placeholderId, isPlaceholder } from '../lib/menuCache'
import { useAvailabilityToggle } from '../hooks/useAvailabilityToggle'
import ItemSheet from '../components/menu/ItemSheet'
import { MenuData, MenuItem, Modifier, ModifierOption } from '../types'

const UNDO_MS = 10_000

// index.css cuts every animation to 0.01ms under reduced motion, which would
// turn an endless pulse into flicker; those users get a steady dim instead.
const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Shown under a row whose switch failed and was put back.
function ToggleError({ message, indent }: { message: string, indent: number }) {
  return (
    <p role="alert" style={{
      padding: `6px 16px 8px ${indent}px`, fontSize: 11, color: 'var(--danger)',
      background: 'var(--s1)', borderBottom: '1px solid var(--border)',
    }}>
      {message}
    </p>
  )
}

function ModifierOptionRow({ option }: { option: ModifierOption }) {
  const tog = useAvailabilityToggle('option', option.id, option.name)
  const on = tog.on(option.is_available)

  return (
    <>
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '9px 16px 9px 32px',
      borderBottom: '1px solid var(--border)',
      opacity: on ? 1 : 0.4,
      transition: 'opacity 0.2s',
      background: 'var(--s1)',
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 1 }}>{option.name}</p>
        {option.price_delta > 0 && (
          <p className="data" style={{ fontSize: 11, color: 'var(--accent)' }}>+&#8369;{option.price_delta}</p>
        )}
      </div>
      <button
        onClick={() => tog.set(on, !on)}
        role="switch"
        aria-checked={on}
        aria-label={`${on ? 'Disable' : 'Enable'} ${option.name} add-on`}
        className={`tog ${on ? 'tog-on' : 'tog-off'}`}
        style={{ marginLeft: 16, transform: 'scale(0.85)' }}
      >
        <span className="tog-knob" />
      </button>
    </div>
    {tog.error && <ToggleError message={tog.error} indent={32} />}
    </>
  )
}

// Inline price field under the row. Opens with the number keypad and the
// current price selected, so typing replaces it.
function PriceEditor({ item, initial, error, onSave, onCancel }: {
  item: MenuItem, initial: string, error: string | null
  onSave: (price: string) => void, onCancel: () => void
}) {
  const [draft, setDraft] = useState(initial)

  return (
    <div style={{ padding: '0 16px 12px', background: 'var(--s1)', borderBottom: '1px solid var(--border)' }}>
      <form
        onSubmit={e => {
          e.preventDefault()
          ;(document.activeElement as HTMLElement | null)?.blur() // Done drops the keyboard
          onSave(draft)
        }}
        style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label htmlFor={`price-${item.id}`} style={{ display: 'none' }}>Price for {item.name}</label>
        <input id={`price-${item.id}`} type="text" inputMode="decimal" enterKeyHint="done" autoComplete="off"
          value={draft} onChange={e => setDraft(e.target.value)}
          autoFocus onFocus={e => e.currentTarget.select()}
          onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
          aria-invalid={!!error} aria-describedby={error ? `price-err-${item.id}` : undefined}
          className="field data" style={{ flex: 1, fontSize: 15 }} />
        <button type="submit" className="btn btn-fire" style={{ minHeight: 'var(--touch)' }}>
          Save
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost" style={{ minHeight: 'var(--touch)' }}>
          Cancel
        </button>
      </form>
      {error && (
        <p id={`price-err-${item.id}`} role="alert" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 8 }}>{error}</p>
      )}
    </div>
  )
}

function MenuItemRow({ item, allModifiers, idx, onOpen }: {
  item: MenuItem, allModifiers: Modifier[], idx: number, onOpen: (item: MenuItem) => void
}) {
  const qc = useQueryClient()
  const tog = useAvailabilityToggle('item', item.id, item.name)
  const on = tog.on(item.is_available)
  const [editing, setEditing] = useState(false)
  const [priceDraft, setPriceDraft] = useState('')
  const [priceError, setPriceError] = useState<string | null>(null)
  // A new item still waiting for its real id: nothing here may send that id.
  const placeholder = isPlaceholder(item)

  const openEditor = () => { setPriceDraft(String(item.base_price)); setPriceError(null); setEditing(true) }
  const closeEditor = () => { setEditing(false); setPriceError(null) }

  // Optimistic: the new price shows and the field closes on Save. If the
  // server refuses, the price goes back and the field reopens with what she
  // typed and the server's sentence.
  const submitPrice = (draft: string) => {
    const price = draft.trim()
    if (!price || !Number.isFinite(Number(price))) { setPriceDraft(draft); return setPriceError('Price must be a number.') }
    closeEditor()
    if (Number(price) === Number(item.base_price)) return // unchanged: nothing to send
    const optimistic = putOptimistic(qc, { ...item, base_price: Number(price) })
    menuApi.updateItem(item.id, { base_price: price }).then(
      saved => settleItem(qc, optimistic, saved),
      err => {
        settleItem(qc, optimistic, item)
        setPriceDraft(draft)
        setPriceError(errorMessage(err))
        setEditing(true)
      },
    )
  }

  // Get modifiers linked to this item — include ALL options (available + unavailable)
  const modIds = item.menu_item_modifiers.map((m: any) => m.modifier_id)
  const itemMods = allModifiers.filter(m => modIds.includes(m.id))

  return (
    <div style={{ animation: `childEnter 0.3s ${idx * 20}ms both` }}>
      {/* Item row. A new item still being saved pulses, so a tap that does
          nothing yet reads as "not ready" rather than "broken". */}
      <div aria-busy={placeholder || undefined} style={{
        display: 'flex', alignItems: 'center', padding: '6px 16px',
        borderBottom: itemMods.length > 0 || editing ? 'none' : '1px solid var(--border)',
        opacity: placeholder ? 0.5 : on ? 1 : 0.4,
        animation: placeholder && !REDUCED_MOTION ? 'pulse 1.2s ease-in-out infinite' : undefined,
        transition: 'opacity 0.2s',
        background: 'var(--s1)',
      }}>
        <button onClick={() => onOpen(item)} disabled={placeholder} aria-label={`Edit ${item.name}`}
          style={{
            flex: 1, minWidth: 0, minHeight: 'var(--touch)', textAlign: 'left',
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, color: 'var(--t1)',
          }}>
          {item.name}
        </button>
        {/* At least the toggle's 52×44 tap area */}
        <button onClick={() => { if (!editing) openEditor() }} disabled={placeholder}
          aria-label={`Change price of ${item.name}, now ₱${item.base_price}`} aria-expanded={editing}
          className="data"
          style={{
            minWidth: 64, minHeight: 'var(--touch)', padding: '0 8px', marginLeft: 8,
            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right',
            fontSize: 13, fontWeight: 700,
            color: 'var(--accent)',
            textDecoration: editing ? 'underline' : 'none',
          }}>
          &#8369;{item.base_price}
        </button>
        <button
          onClick={() => tog.set(on, !on)}
          disabled={placeholder}
          role="switch"
          aria-checked={on}
          aria-label={`${on ? 'Disable' : 'Enable'} ${item.name}`}
          className={`tog ${on ? 'tog-on' : 'tog-off'}`}
          style={{ marginLeft: 12 }}
        >
          <span className="tog-knob" />
        </button>
      </div>
      {editing && (
        <PriceEditor item={item} initial={priceDraft} error={priceError}
          onSave={submitPrice} onCancel={closeEditor} />
      )}
      {tog.error && <ToggleError message={tog.error} indent={16} />}

      {/* Modifier options — indented under their item */}
      {itemMods.map(mod => (
        <div key={mod.id}>
          {/* Modifier group label */}
          <div style={{
            padding: '5px 16px 4px 32px',
            background: 'var(--s2)',
            borderBottom: '1px solid var(--border)',
            borderTop: '1px solid var(--border)',
          }}>
            <p style={{
              fontFamily: 'JetBrains Mono', fontSize: 8,
              color: 'var(--t3)', letterSpacing: '0.08em',
            }}>
              {mod.name.toUpperCase()} {mod.is_required && '· REQUIRED'}
            </p>
          </div>
          {/* Each option */}
          {mod.modifier_options.map(opt => (
            <ModifierOptionRow key={opt.id} option={opt} />
          ))}
        </div>
      ))}

      {/* Bottom border after modifiers */}
      {itemMods.length > 0 && (
        <div style={{ height: 1, background: 'var(--border)' }} />
      )}
    </div>
  )
}

// The open sheet: an item to edit, or a category to add to. After a failed
// save it reopens with what she typed and the server's sentence.
type Sheet = { item: MenuItem | null, categoryId: string, draft?: ItemFields, error?: string } | null
type Bar = { id: number, text: string, onUndo?: () => void } | null

export default function MenuPage() {
  const qc = useQueryClient()
  const { data: menuData, isLoading } = useQuery<MenuData>({
    queryKey: keys.menu,
    queryFn: menuApi.getMenu,
  })
  const [sheet, setSheet] = useState<Sheet>(null)
  const [bar, setBar] = useState<Bar>(null)
  const barId = useRef(0)

  const showBar = (text: string, onUndo?: () => void) => setBar({ id: ++barId.current, text, onUndo })

  // Each bar lasts 10s; a newer one restarts the clock.
  useEffect(() => {
    if (!bar) return
    const t = setTimeout(() => setBar(b => b?.id === bar.id ? null : b), UNDO_MS)
    return () => clearTimeout(t)
  }, [bar])

  // Save from the sheet, optimistic: the sheet closes and the change shows at
  // once (a new item appears with a placeholder id until the server gives it
  // a real one). If the server refuses, the change is taken back and the
  // sheet reopens with what she typed and the server's sentence.
  const saveItem = (item: MenuItem | null, f: ItemFields) => {
    const moved = !item || item.category_id !== f.category_id
    const optimistic = putOptimistic(qc, {
      ...(item ?? { business_id: '', description: null, image_url: null, is_available: true }),
      id: item?.id ?? placeholderId(),
      name: f.name.split(/\s+/).filter(Boolean).join(' '), // the server tidies spaces the same way
      base_price: Number(f.base_price),
      category_id: f.category_id,
      menu_item_modifiers: f.modifier_ids.map(modifier_id => ({ modifier_id })),
      sort_order: moved ? nextSortOrder(qc, f.category_id) : item.sort_order,
    })
    setSheet(null)
    ;(item ? menuApi.updateItem(item.id, f) : menuApi.createItem(f)).then(
      saved => settleItem(qc, optimistic, saved),
      err => {
        settleItem(qc, optimistic, item)
        setSheet({ item, categoryId: f.category_id, draft: f, error: errorMessage(err) })
      },
    )
  }

  // No confirmation: the item goes at once and the bar offers Undo instead.
  const deleteItem = (sheetItem: MenuItem) => {
    // The cached copy, not the sheet's: a toggle since the sheet opened made a newer one.
    const item = qc.getQueryData<MenuData>(keys.menu)?.items.find(i => i.id === sheetItem.id) ?? sheetItem
    setSheet(null)
    removeItem(qc, item.id)
    let undone = false
    const deleted = menuApi.deleteItem(item.id)
    deleted.catch(err => {
      if (undone) return // Undo already put it back, and it was never deleted
      putItem(qc, item)
      showBar(`Couldn't delete ${item.name}. ${errorMessage(err)}`)
    })

    showBar(`${item.name} deleted`, () => {
      undone = true
      setBar(null)
      const back = putOptimistic(qc, item) // back in its place now; the server catches up below
      // Undo can be tapped before the delete has even reached the server.
      deleted.then(() => menuApi.restoreItem(item.id).then(
        restored => settleItem(qc, back, restored),
        err => {
          settleItem(qc, back, null)
          showBar(`Couldn't bring back ${item.name}. ${errorMessage(err)}`)
        },
      ), () => {})
    })
  }

  if (isLoading) return (
    <div style={{ padding: 16 }}>
      {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8 }} />)}
    </div>
  )

  const cats = menuData?.categories ?? []
  const items = menuData?.items ?? []
  const avail = items.filter((i: MenuItem) => i.is_available).length

  // Build full modifier list including ALL options (not filtered by availability)
  // so we can show them with their own toggles
  const allModifiers: Modifier[] = (menuData?.modifiers ?? []).map((mod: any) => ({
    ...mod,
    // Re-include unavailable options so they can be toggled back on
    modifier_options: mod.modifier_options ?? [],
  }))

  return (
    <div className="page-enter" style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 32 }}>
      <div style={{ padding: '16px 16px 14px' }}>
        <h1 className="display" style={{ fontSize: 40, color: 'var(--t1)', lineHeight: 0.95 }}>MENU</h1>
        <p role="status" style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: 'var(--t3)', marginTop: 8, letterSpacing: '0.06em' }}>
          {avail}/{items.length} ITEMS AVAILABLE
        </p>
      </div>

      {/* Every category shows, even empty ones, so she can add to them */}
      {cats.map((cat: any) => {
        const catItems = items.filter((i: MenuItem) => i.category_id === cat.id)
        return (
          <section key={cat.id} aria-label={cat.name} style={{ marginBottom: 12 }}>
            {/* Category header */}
            <div style={{
              padding: '8px 16px',
              background: 'var(--s2)',
              borderTop: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
            }}>
              <p className="label">{cat.name}</p>
            </div>
            {/* Items */}
            <div>
              {catItems.map((item: MenuItem, idx: number) => (
                <MenuItemRow
                  key={item.id}
                  item={item}
                  allModifiers={allModifiers}
                  idx={idx}
                  onOpen={i => setSheet({ item: i, categoryId: i.category_id })}
                />
              ))}
            </div>
            <button onClick={() => setSheet({ item: null, categoryId: cat.id })}
              aria-label={`Add item to ${cat.name}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                minHeight: 'var(--touch)', padding: '0 16px',
                background: 'var(--s1)', border: 'none', borderBottom: '1px solid var(--border)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--accent)',
              }}>
              <Plus size={13} strokeWidth={2.5} aria-hidden="true" />
              Add item
            </button>
          </section>
        )
      })}

      {/* Undo bar, fixed just above the bottom nav (about 57px tall). Not
          sticky: sticky attaches to <main> (overflow: auto), which never
          scrolls itself — the page does — so a sticky bar sat at the end of
          the menu, off-screen. Portalled to <body> because .page-enter's
          transform would turn fixed into "fixed to this page". Above the nav
          (100), below the item sheet (110). */}
      {createPortal(
      <div role="status" aria-live="polite" style={{
        position: 'fixed', left: 0, right: 0, bottom: 'calc(68px + env(safe-area-inset-bottom, 0px))',
        maxWidth: 480, margin: '0 auto', padding: '0 12px', zIndex: 105,
      }}>
        {bar && (
          <div className="panel" style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '6px 6px 6px 16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)', animation: 'fadeIn 0.2s both',
          }}>
            <p style={{ flex: 1, fontSize: 13, color: 'var(--t1)', padding: '8px 0' }}>{bar.text}</p>
            {bar.onUndo && (
              <button onClick={bar.onUndo} className="btn btn-ghost" style={{ minHeight: 'var(--touch)' }}>Undo</button>
            )}
          </div>
        )}
      </div>,
      document.body,
      )}

      {sheet && menuData && (
        <ItemSheet
          // A reopen after a failed save remounts, so it starts from the draft.
          key={`${sheet.item?.id ?? `new-${sheet.categoryId}`}-${sheet.error ?? ''}`}
          menu={menuData}
          item={sheet.item}
          categoryId={sheet.categoryId}
          draft={sheet.draft}
          error={sheet.error}
          onSave={f => saveItem(sheet.item, f)}
          onClose={() => setSheet(null)}
          onDelete={deleteItem}
        />
      )}
    </div>
  )
}
