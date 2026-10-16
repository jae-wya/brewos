import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { menuApi, errorMessage, ItemFields } from '../lib/api'
import { keys } from '../lib/queryKeys'
import { putItem, putOptimistic, removeItem, settleItem, nextSortOrder, placeholderId, isPlaceholder } from '../lib/menuCache'
import { shownAvailability } from '../lib/availabilityWrites'
import { useAvailabilityToggle } from '../hooks/useAvailabilityToggle'
import { useNavHeight } from '../hooks/useNavHeight'
import ItemSheet from '../components/menu/ItemSheet'
import CategoryBar from '../components/CategoryBar'
import { MenuData, MenuItem, Modifier, ModifierOption } from '../types'

// The Menu page has two views:
//   Items    — every item once: name, its add-on groups as one muted line,
//              price, on/off. A pinned bar jumps between categories.
//   Add-ons  — every add-on group once, with its options' switches.
// Add-on groups are shared: "Coffee Add-Ons" belongs to twenty coffees. They
// used to be drawn under every item (124 rows, 17 screens of scrolling), and
// a switch shown under one drink silently changed all twenty. Here each
// switch appears once, where it really lives.
//
// "Off right now" narrows either view to what's switched off — the list is
// frozen when the filter is turned on, so switching something back on doesn't
// make it vanish under her thumb.

const UNDO_MS = 10_000
const JUMP_BAR_HEIGHT = 63 // CategoryBar: 44px chips + 18px padding + 1px border

// index.css cuts every animation to 0.01ms under reduced motion, which would
// turn an endless pulse into flicker; those users get a steady dim instead.
const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Shown under a row whose switch failed and was put back.
function ToggleError({ message }: { message: string }) {
  return (
    <p role="alert" style={{
      padding: '6px 16px 8px', fontSize: 12, color: 'var(--danger)',
      background: 'var(--s1)', borderBottom: '1px solid var(--border)',
    }}>
      {message}
    </p>
  )
}

// "Off" said in words, not by fading the row: a row at 40% opacity was
// unreadable exactly when she was looking for it to turn back on.
function OffTag() {
  return (
    <span className="label" style={{ marginLeft: 8, color: 'var(--danger)' }}>Off</span>
  )
}

function ModifierOptionRow({ option }: { option: ModifierOption }) {
  const tog = useAvailabilityToggle('option', option.id, option.name)
  const on = tog.on(option.is_available)

  return (
    <>
    <div style={{
      display: 'flex', alignItems: 'center', minHeight: 56,
      padding: '6px 16px', borderBottom: '1px solid var(--border)', background: 'var(--s1)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: on ? 'var(--t1)' : 'var(--t2)' }}>
          {option.name}{!on && <OffTag />}
        </p>
        {option.price_delta > 0 && (
          <p className="data" style={{ fontSize: 12, color: 'var(--t1)', marginTop: 2 }}>+&#8369;{option.price_delta}</p>
        )}
      </div>
      <button
        onClick={() => tog.set(on, !on)}
        role="switch"
        aria-checked={on}
        aria-label={`${on ? 'Disable' : 'Enable'} ${option.name} add-on`}
        className={`tog ${on ? 'tog-on' : 'tog-off'}`}
        style={{ marginLeft: 16 }}
      >
        <span className="tog-knob" />
      </button>
    </div>
    {tog.error && <ToggleError message={tog.error} />}
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
        <button type="submit" className="btn btn-fire">Save</button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">Cancel</button>
      </form>
      {error && (
        <p id={`price-err-${item.id}`} role="alert" style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{error}</p>
      )}
    </div>
  )
}

function MenuItemRow({ item, groupNames, onOpen }: {
  item: MenuItem, groupNames: string[], onOpen: (item: MenuItem) => void
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

  return (
    <div>
      {/* Item row. A new item still being saved pulses, so a tap that does
          nothing yet reads as "not ready" rather than "broken". */}
      <div aria-busy={placeholder || undefined} style={{
        display: 'flex', alignItems: 'center', padding: '6px 16px', minHeight: 60,
        borderBottom: editing ? 'none' : '1px solid var(--border)',
        opacity: placeholder ? 0.5 : 1,
        animation: placeholder && !REDUCED_MOTION ? 'pulse 1.2s ease-in-out infinite' : undefined,
        background: 'var(--s1)',
      }}>
        <button onClick={() => onOpen(item)} disabled={placeholder} aria-label={`Edit ${item.name}`}
          style={{
            flex: 1, minWidth: 0, minHeight: 'var(--touch)', textAlign: 'left',
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: on ? 'var(--t1)' : 'var(--t2)' }}>
            {item.name}{!on && <OffTag />}
          </span>
          {/* Which shared add-on groups it uses; edited on the Add-ons tab. */}
          {groupNames.length > 0 && (
            <span style={{ display: 'block', fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>
              {groupNames.join(' · ')}
            </span>
          )}
        </button>
        <button onClick={() => { if (!editing) openEditor() }} disabled={placeholder}
          aria-label={`Change price of ${item.name}, now ₱${item.base_price}`} aria-expanded={editing}
          className="data"
          style={{
            minWidth: 64, minHeight: 'var(--touch)', padding: '0 8px', marginLeft: 8,
            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right',
            fontSize: 14, fontWeight: 700,
            color: 'var(--t1)',
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
      {tog.error && <ToggleError message={tog.error} />}
    </div>
  )
}

// The open sheet: an item to edit, or a category to add to. After a failed
// save it reopens with what she typed and the server's sentence.
type Sheet = { item: MenuItem | null, categoryId: string, draft?: ItemFields, error?: string } | null
type Bar = { id: number, text: string, onUndo?: () => void } | null
type View = 'items' | 'addons'

const sectionId = (catId: string) => `menu-cat-${catId}`

export default function MenuPage() {
  const qc = useQueryClient()
  const { data: menuData, isLoading } = useQuery<MenuData>({
    queryKey: keys.menu,
    queryFn: menuApi.getMenu,
  })
  const [sheet, setSheet] = useState<Sheet>(null)
  const [bar, setBar] = useState<Bar>(null)
  const barId = useRef(0)
  const [view, setView] = useState<View>('items')
  // "Off right now": the keys ('item:<id>' / 'option:<id>') that were off when
  // the filter was turned on. null = filter off.
  const [offOnly, setOffOnly] = useState<Set<string> | null>(null)
  const [activeCat, setActiveCat] = useState<string | undefined>(undefined)
  // After a jump, the tapped category stays highlighted: the last few
  // categories can't scroll to the top of the screen (the page ends), so
  // "whichever section reached the top" would name the one before it.
  const jumpedUntil = useRef(0)
  const navHeight = useNavHeight()

  const showBar = (text: string, onUndo?: () => void) => setBar({ id: ++barId.current, text, onUndo })

  // Each bar lasts 10s; a newer one restarts the clock.
  useEffect(() => {
    if (!bar) return
    const t = setTimeout(() => setBar(b => b?.id === bar.id ? null : b), UNDO_MS)
    return () => clearTimeout(t)
  }, [bar])

  const cats = menuData?.categories ?? []
  const items = menuData?.items ?? []
  const modifiers: Modifier[] = menuData?.modifiers ?? []
  const showJumpBar = view === 'items' && !offOnly && cats.length > 1

  // Highlight the category she's scrolled to.
  useEffect(() => {
    if (!showJumpBar) return
    let frame = 0
    const onScroll = () => {
      if (Date.now() < jumpedUntil.current) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        let current = cats[0]?.id
        for (const c of cats) {
          const el = document.getElementById(sectionId(c.id))
          if (el && el.getBoundingClientRect().top <= 72) current = c.id
        }
        setActiveCat(current)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame) }
  }, [showJumpBar, cats.length])

  const jumpTo = (catId: string) => {
    setActiveCat(catId)
    jumpedUntil.current = Date.now() + 1200 // the scroll this jump causes
    document.getElementById(sectionId(catId))?.scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'start' })
  }

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

  const itemOn = (i: MenuItem) => shownAvailability('item', i.id, i.is_available)
  const optionOn = (o: ModifierOption) => shownAvailability('option', o.id, o.is_available)
  const itemsOn = items.filter(itemOn).length
  const offKeys = () => new Set([
    ...items.filter(i => !itemOn(i)).map(i => `item:${i.id}`),
    ...modifiers.flatMap(m => m.modifier_options).filter(o => !optionOn(o)).map(o => `option:${o.id}`),
  ])
  const offCount = offKeys().size
  const usedBy = (modId: string) => items.filter(i => i.menu_item_modifiers.some(l => l.modifier_id === modId)).length
  const groupNames = (i: MenuItem) => i.menu_item_modifiers
    .map(l => modifiers.find(m => m.id === l.modifier_id)?.name).filter((n): n is string => !!n)

  // Each category (and add-on group) is an enamel sign over its stretch of
  // the counter: a lit plate, the name hand-lettered in Bebas.
  const sectionHeader = (title: string, meta?: string) => (
    <div style={{ padding: '12px 16px 10px', background: 'var(--s2)', borderTop: '1px solid var(--border-hi)', borderBottom: '1px solid var(--border)', boxShadow: 'inset 0 1px 0 var(--rim)', display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <h2 className="display" style={{ fontSize: 24, color: 'var(--t1)', lineHeight: 1, letterSpacing: '0.04em' }}>{title}</h2>
      {meta && <p className="data" style={{ fontSize: 11, color: 'var(--t2)', marginLeft: 'auto' }}>{meta}</p>}
    </div>
  )

  const shownItems = (catId: string) => items.filter(i => i.category_id === catId && (!offOnly || offOnly.has(`item:${i.id}`)))
  const shownOptions = (m: Modifier) => m.modifier_options.filter(o => !offOnly || offOnly.has(`option:${o.id}`))
  const nothingOff = offOnly && (view === 'items'
    ? !items.some(i => offOnly.has(`item:${i.id}`))
    : !modifiers.some(m => shownOptions(m).length))

  return (
    <div className="page-enter" style={{ maxWidth: 480, margin: '0 auto', paddingBottom: showJumpBar ? JUMP_BAR_HEIGHT + 24 : 32 }}>
      <div style={{ padding: '16px 16px 12px' }}>
        <h1 className="display" style={{ fontSize: 40, color: 'var(--t1)', lineHeight: 0.95 }}>MENU</h1>
        <p role="status" style={{ fontSize: 12, color: 'var(--t2)', marginTop: 8 }}>
          {itemsOn} of {items.length} items on{offCount > 0 ? ` · ${offCount} things off` : ''}
        </p>
      </div>

      {/* Items / Add-ons, and the "Off right now" filter */}
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px', alignItems: 'center' }}>
        <div role="tablist" aria-label="Menu view" style={{ display: 'flex', gap: 8 }}>
          {([['items', 'Items'], ['addons', 'Add-ons']] as const).map(([v, label]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => { setView(v); window.scrollTo({ top: 0 }) }}
              className={`chip ${view === v ? 'chip-on' : ''}`}>
              {label}
            </button>
          ))}
        </div>
        <button aria-pressed={!!offOnly} onClick={() => setOffOnly(o => o ? null : offKeys())}
          className={`chip ${offOnly ? 'chip-on' : ''}`} style={{ marginLeft: 'auto' }}>
          Off now{offCount ? ` · ${offCount}` : ''}
        </button>
      </div>

      {nothingOff && (
        <p role="status" style={{ padding: '24px 16px', fontSize: 13, color: 'var(--t2)', textAlign: 'center' }}>
          Nothing {view === 'items' ? 'on the menu' : 'in the add-ons'} is off right now.
        </p>
      )}

      {view === 'items' && cats.map(cat => {
        const catItems = shownItems(cat.id)
        // Every category shows, even empty ones, so she can add to them —
        // except under "Off now", which shows only what's off.
        if (offOnly && !catItems.length) return null
        return (
          <section key={cat.id} id={sectionId(cat.id)} aria-label={cat.name} data-board
            style={{ marginBottom: 12, scrollMarginTop: 62 }}>
            {sectionHeader(cat.name, `${catItems.length} item${catItems.length === 1 ? '' : 's'}`)}
            {catItems.map(item => (
              <MenuItemRow key={item.id} item={item} groupNames={groupNames(item)}
                onOpen={i => setSheet({ item: i, categoryId: i.category_id })} />
            ))}
            {!offOnly && (
              <button onClick={() => setSheet({ item: null, categoryId: cat.id })}
                aria-label={`Add item to ${cat.name}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                  minHeight: 52, padding: '0 16px',
                  background: 'var(--s1)', border: 'none', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--t1)',
                }}>
                <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
                Add item
              </button>
            )}
          </section>
        )
      })}

      {view === 'addons' && modifiers.map(m => {
        const options = shownOptions(m)
        if (offOnly && !options.length) return null
        const n = usedBy(m.id)
        return (
          <section key={m.id} aria-label={m.name} data-board style={{ marginBottom: 12 }}>
            {sectionHeader(m.name, `${m.is_required ? 'Required · ' : ''}on ${n} item${n === 1 ? '' : 's'}`)}
            {options.map(o => <ModifierOptionRow key={o.id} option={o} />)}
          </section>
        )
      })}

      {/* Category jump bar, pinned just above the bottom nav where the thumb
          is. Fixed, not sticky (sticky attaches to <main>, which doesn't
          scroll), and portalled to <body> so .page-enter's transform can't
          capture it. Under the item sheet (110) and the undo bar (105). */}
      {showJumpBar && createPortal(
        <div data-board style={{ position: 'fixed', left: 0, right: 0, bottom: navHeight, maxWidth: 480, margin: '0 auto', zIndex: 101 }}>
          <CategoryBar kind="jump" label="Jump to category" cats={cats} active={activeCat ?? cats[0]?.id} onPick={jumpTo} />
        </div>,
        document.body,
      )}

      {/* Undo bar, just above the nav — and above the jump bar when it shows.
          Fixed and portalled for the same reasons. Above the nav (100), below
          the item sheet (110). */}
      {createPortal(
      <div role="status" aria-live="polite" style={{
        position: 'fixed', left: 0, right: 0, bottom: navHeight + (showJumpBar ? JUMP_BAR_HEIGHT : 0) + 12,
        maxWidth: 480, margin: '0 auto', padding: '0 12px', zIndex: 105,
      }}>
        {bar && (
          <div className="panel" style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '6px 6px 6px 16px',
            boxShadow: '0 8px 24px var(--cast)', animation: 'fadeIn 0.2s both',
          }}>
            <p style={{ flex: 1, fontSize: 13, color: 'var(--t1)', padding: '8px 0' }}>{bar.text}</p>
            {bar.onUndo && (
              <button onClick={bar.onUndo} className="btn btn-ghost">Undo</button>
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
