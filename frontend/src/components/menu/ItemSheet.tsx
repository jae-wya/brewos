import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { ItemFields } from '../../lib/api'
import { MenuData, MenuItem } from '../../types'

// Add-on groups a new item starts with: the ones most items in that category
// already have (at least half), so a new drink gets Size and Sugar but not a
// sauce one snack happens to use. An empty category starts with none.
function categoryModifiers(menu: MenuData, categoryId: string): string[] {
  const siblings = menu.items.filter(i => i.category_id === categoryId)
  if (!siblings.length) return []
  return menu.modifiers
    .filter(m => {
      const using = siblings.filter(i => i.menu_item_modifiers.some(l => l.modifier_id === m.id)).length
      return using * 2 >= siblings.length
    })
    .map(m => m.id)
}

// Bottom sheet for editing an item, or adding one when `item` is null.
// Same frame as the add-on picker on the order screen.
//
// It doesn't save anything itself: Save hands the fields to the Menu page,
// which closes the sheet, shows the change at once and sends it. If the
// server refuses, the page reopens the sheet with `draft` (what she typed)
// and `error` (the server's sentence).
export default function ItemSheet({ menu, item, categoryId, draft, error: initialError, onSave, onClose, onDelete }: {
  menu: MenuData
  item: MenuItem | null
  categoryId: string          // pre-selected category for a new item
  draft?: ItemFields
  error?: string
  onSave: (fields: ItemFields) => void
  onClose: () => void
  onDelete: (item: MenuItem) => void
}) {
  const [name, setName] = useState(draft?.name ?? item?.name ?? '')
  const [price, setPrice] = useState(draft?.base_price ?? (item ? String(item.base_price) : ''))
  const [catId, setCatId] = useState(draft?.category_id ?? item?.category_id ?? categoryId)
  const [modIds, setModIds] = useState<string[]>(draft?.modifier_ids ??
    (item ? item.menu_item_modifiers.map(m => m.modifier_id) : categoryModifiers(menu, categoryId)))
  // Once she's ticked an add-on herself, changing category no longer resets them.
  const [modsTouched, setModsTouched] = useState(!!draft)
  const [error, setError] = useState<string | null>(initialError ?? null)

  // Same sentences the server uses, for what can be checked without asking it.
  const submit = () => {
    if (!name.trim()) return setError("Name can't be empty.")
    if (!price.trim() || !Number.isFinite(Number(price.trim()))) return setError('Price must be a number.')
    onSave({ name, base_price: price.trim(), category_id: catId, modifier_ids: modIds })
  }

  const pickCategory = (id: string) => {
    setCatId(id)
    if (!item && !modsTouched) setModIds(categoryModifiers(menu, id))
  }

  const toggleMod = (id: string) => {
    setModsTouched(true)
    setModIds(ids => ids.includes(id) ? ids.filter(m => m !== id) : [...ids, id])
  }

  // Portalled to <body>: the Menu page's wrapper keeps a transform from its
  // .page-enter animation, and a transformed ancestor turns position: fixed
  // into "fixed to that element" — the panel landed at the bottom of the
  // whole page, off-screen. Above the sticky header and nav (zIndex 100) so
  // the nav can't cover Delete.
  return createPortal(
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(20,16,12,0.92)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={item ? `Edit ${item.name}` : 'New item'}
        style={{
          width: '100%', maxWidth: 480,
          background: 'var(--s1)',
          borderRadius: '16px 16px 0 0',
          maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          animation: 'pageEnter 0.28s cubic-bezier(.22,1,.36,1) both',
        }}>

        {/* Drag handle */}
        <div style={{ width: 32, height: 3, background: 'var(--s3)', borderRadius: 999, margin: '12px auto 0', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span className="display" style={{ fontSize: 26, color: 'var(--t1)' }}>{item ? 'EDIT ITEM' : 'NEW ITEM'}</span>
          <button onClick={onClose} aria-label="Close" className="icon-btn">
            <X size={13} aria-hidden="true" />
          </button>
        </div>

        {/* Fields — scroll; Save stays put below */}
        <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: 18 }}>
            <label htmlFor="item-name" className="label" style={{ display: 'block', marginBottom: 10 }}>Name</label>
            <input id="item-name" type="text" value={name} onChange={e => setName(e.target.value)}
              autoFocus={!item} autoComplete="off" enterKeyHint="next" maxLength={60}
              placeholder="Spanish Latte" className="field" />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label htmlFor="item-price" className="label" style={{ display: 'block', marginBottom: 10 }}>Price (&#8369;)</label>
            <input id="item-price" type="text" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)}
              autoComplete="off" enterKeyHint="done" placeholder="0"
              onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); submit() } }}
              className="field data" />
          </div>

          <div style={{ marginBottom: 18 }}>
            <p className="label" style={{ marginBottom: 10 }}>Category</p>
            <div className="scrollbar-none" role="radiogroup" aria-label="Category"
              style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -16px', padding: '0 16px' }}>
              {menu.categories.map(c => (
                <button key={c.id} onClick={() => pickCategory(c.id)} role="radio" aria-checked={catId === c.id}
                  className={`chip flex-shrink-0 ${catId === c.id ? 'chip-on' : ''}`}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {menu.modifiers.length > 0 && (
            <div>
              <p className="label" style={{ marginBottom: 4 }}>Add-ons</p>
              {menu.modifiers.map(m => {
                const on = modIds.includes(m.id)
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', minHeight: 56, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{m.name}</p>
                      <p style={{ fontSize: 12, color: 'var(--t2)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.modifier_options.map(o => o.name).join(', ')}
                      </p>
                    </div>
                    <button onClick={() => toggleMod(m.id)} role="switch" aria-checked={on}
                      aria-label={`${m.name} add-ons`}
                      className={`tog ${on ? 'tog-on' : 'tog-off'}`} style={{ marginLeft: 16 }}>
                      <span className="tog-knob" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Save within thumb reach; Delete well below it */}
        <div style={{ padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {error && (
            <p role="alert" style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>{error}</p>
          )}
          <button onClick={submit}
            className="btn btn-fire" style={{ width: '100%', padding: '16px', fontSize: 15 }}>
            {item ? 'Save' : 'Add item'}
          </button>
          {item && (
            <button onClick={() => onDelete(item)}
              style={{
                display: 'block', margin: '20px auto 0', minHeight: 'var(--touch)', padding: '0 20px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, color: 'var(--danger)',
              }}>
              Delete item
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
