import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { menuApi } from '../lib/api'
import { MenuData, MenuItem } from '../types'

interface ModifierOption {
  id: string
  name: string
  price_delta: number
  is_available: boolean
}

interface Modifier {
  id: string
  name: string
  is_required: boolean
  modifier_options: ModifierOption[]
}

function ModifierOptionRow({ option, modifierName }: { option: ModifierOption, modifierName: string }) {
  const qc = useQueryClient()
  const tog = useMutation({
    mutationFn: () => menuApi.toggleModifierOption(option.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu'] })
  })

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '9px 16px 9px 32px',
      borderBottom: '1px solid var(--border)',
      opacity: option.is_available ? 1 : 0.4,
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
        onClick={() => tog.mutate()}
        disabled={tog.isPending}
        role="switch"
        aria-checked={option.is_available}
        aria-label={`${option.is_available ? 'Disable' : 'Enable'} ${option.name} add-on`}
        className={`tog ${option.is_available ? 'tog-on' : 'tog-off'}`}
        style={{ marginLeft: 16, transform: 'scale(0.85)' }}
      >
        <span className="tog-knob" />
      </button>
    </div>
  )
}

function MenuItemRow({ item, allModifiers, idx }: {
  item: MenuItem, allModifiers: Modifier[], idx: number
}) {
  const qc = useQueryClient()
  const tog = useMutation({
    mutationFn: () => menuApi.toggleItem(item.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu'] })
  })

  // Get modifiers linked to this item — include ALL options (available + unavailable)
  const modIds = item.menu_item_modifiers.map((m: any) => m.modifier_id)
  const itemMods = allModifiers.filter(m => modIds.includes(m.id))

  return (
    <div style={{ animation: `childEnter 0.3s ${idx * 20}ms both` }}>
      {/* Item row */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '12px 16px',
        borderBottom: itemMods.length > 0 ? 'none' : '1px solid var(--border)',
        opacity: item.is_available ? 1 : 0.4,
        transition: 'opacity 0.2s',
        background: 'var(--s1)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 2 }}>{item.name}</p>
          <p className="data" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>
            &#8369;{item.base_price}
          </p>
        </div>
        <button
          onClick={() => tog.mutate()}
          disabled={tog.isPending}
          role="switch"
          aria-checked={item.is_available}
          aria-label={`${item.is_available ? 'Disable' : 'Enable'} ${item.name}`}
          className={`tog ${item.is_available ? 'tog-on' : 'tog-off'}`}
          style={{ marginLeft: 16 }}
        >
          <span className="tog-knob" />
        </button>
      </div>

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
            <ModifierOptionRow key={opt.id} option={opt} modifierName={mod.name} />
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

export default function MenuPage() {
  const { data: menuData, isLoading } = useQuery<MenuData>({
    queryKey: ['menu'],
    queryFn: menuApi.getMenu,
  })

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

      {cats.map((cat: any) => {
        const catItems = items.filter((i: MenuItem) => i.category_id === cat.id)
        if (!catItems.length) return null
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
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
