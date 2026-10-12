import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { menuApi, errorMessage } from '../lib/api'
import { keys, refreshMenus } from '../lib/queryKeys'
import { putItem, removeItem } from '../lib/menuCache'
import { useAvailabilityToggle } from '../hooks/useAvailabilityToggle'
import ItemSheet from '../components/menu/ItemSheet'
import { MenuData, MenuItem, Modifier, ModifierOption } from '../types'

const UNDO_MS = 10_000

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
function PriceEditor({ item, saving, error, onSave, onCancel }: {
  item: MenuItem, saving: boolean, error: string | null
  onSave: (price: string) => void, onCancel: () => void
}) {
  const [draft, setDraft] = useState(String(item.base_price))

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
          readOnly={saving} aria-invalid={!!error} aria-describedby={error ? `price-err-${item.id}` : undefined}
          className="field data" style={{ flex: 1, fontSize: 15 }} />
        <button type="submit" disabled={saving} className="btn btn-fire" style={{ minHeight: 'var(--touch)' }}>
          Save
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="btn btn-ghost" style={{ minHeight: 'var(--touch)' }}>
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
  const [priceError, setPriceError] = useState<string | null>(null)

  const savePrice = useMutation({
    mutationFn: (price: string) => menuApi.updateItem(item.id, { base_price: price }),
    onMutate: () => setPriceError(null),
    onSuccess: saved => {
      putItem(qc, saved)
      refreshMenus(qc)
      setEditing(false)
    },
    onError: err => setPriceError(errorMessage(err)),
  })

  const submitPrice = (draft: string) => {
    const price = draft.trim()
    if (!price) return setPriceError('Price must be a number.')
    if (Number(price) === Number(item.base_price)) return setEditing(false) // unchanged: nothing to send
    savePrice.mutate(price)
  }

  const closeEditor = () => { setEditing(false); setPriceError(null) }

  // Get modifiers linked to this item — include ALL options (available + unavailable)
  const modIds = item.menu_item_modifiers.map((m: any) => m.modifier_id)
  const itemMods = allModifiers.filter(m => modIds.includes(m.id))

  return (
    <div style={{ animation: `childEnter 0.3s ${idx * 20}ms both` }}>
      {/* Item row */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '6px 16px',
        borderBottom: itemMods.length > 0 || editing ? 'none' : '1px solid var(--border)',
        opacity: on ? 1 : 0.4,
        transition: 'opacity 0.2s',
        background: 'var(--s1)',
      }}>
        <button onClick={() => onOpen(item)} aria-label={`Edit ${item.name}`}
          style={{
            flex: 1, minWidth: 0, minHeight: 'var(--touch)', textAlign: 'left',
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, color: 'var(--t1)',
          }}>
          {item.name}
        </button>
        {/* At least the toggle's 52×44 tap area */}
        <button onClick={() => { if (!editing) { setPriceError(null); setEditing(true) } }}
          aria-label={`Change price of ${item.name}, now ₱${item.base_price}`} aria-expanded={editing}
          className="data"
          style={{
            minWidth: 64, minHeight: 'var(--touch)', padding: '0 8px', marginLeft: 8,
            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right',
            fontSize: 13, fontWeight: 700,
            color: savePrice.isPending ? 'var(--t3)' : 'var(--accent)',
            textDecoration: editing && !savePrice.isPending ? 'underline' : 'none',
          }}>
          {savePrice.isPending ? <span role="status">Saving…</span> : <>&#8369;{item.base_price}</>}
        </button>
        <button
          onClick={() => tog.set(on, !on)}
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
        <PriceEditor item={item} saving={savePrice.isPending} error={priceError}
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

type Sheet = { item: MenuItem } | { categoryId: string } | null
type Bar = { id: number, text: string, onUndo?: () => void } | null

export default function MenuPage() {
  const qc = useQueryClient()
  const { data: menuData, isLoading } = useQuery<MenuData>({
    queryKey: keys.menuFull,
    queryFn: menuApi.getFullMenu,
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

  // No confirmation: the item goes at once and the bar offers Undo instead.
  const deleteItem = (item: MenuItem) => {
    setSheet(null)
    removeItem(qc, item.id)
    let undone = false
    const deleted = menuApi.deleteItem(item.id)
    deleted.then(
      () => { if (!undone) refreshMenus(qc) }, // after Undo, the restore reloads instead
      err => {
        refreshMenus(qc) // it was never deleted: the reload puts it back
        if (!undone) showBar(`Couldn't delete ${item.name}. ${errorMessage(err)}`)
      },
    )

    showBar(`${item.name} deleted`, () => {
      undone = true
      setBar(null)
      putItem(qc, item) // back on screen now; the server catches up below
      // Undo can be tapped before the delete has even reached the server.
      deleted.then(() => menuApi.restoreItem(item.id).then(
        restored => { putItem(qc, restored); refreshMenus(qc) },
        err => { removeItem(qc, item.id); refreshMenus(qc); showBar(`Couldn't bring back ${item.name}. ${errorMessage(err)}`) },
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
                  onOpen={i => setSheet({ item: i })}
                />
              ))}
            </div>
            <button onClick={() => setSheet({ categoryId: cat.id })}
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
          key={'item' in sheet ? sheet.item.id : `new-${sheet.categoryId}`}
          menu={menuData}
          item={'item' in sheet ? sheet.item : null}
          categoryId={'item' in sheet ? sheet.item.category_id : sheet.categoryId}
          onClose={() => setSheet(null)}
          onDelete={deleteItem}
        />
      )}
    </div>
  )
}
