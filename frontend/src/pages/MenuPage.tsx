import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { menuApi } from '../lib/api'
import { MenuData, MenuItem } from '../types'

function MenuItemRow({ item }: { item: MenuItem }) {
  const qc = useQueryClient()
  const toggle = useMutation({
    mutationFn: () => menuApi.toggleItem(item.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu'] })
  })

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px', borderBottom: '1px solid var(--border)',
      opacity: item.is_available ? 1 : 0.4, transition: 'opacity 0.2s',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{item.name}</p>
        <p className="font-mono" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>₱{item.base_price}</p>
      </div>
      <button onClick={() => toggle.mutate()} disabled={toggle.isPending}
        className={`toggle ${item.is_available ? 'toggle-on' : 'toggle-off'}`}
        style={{ marginLeft: 12 }}>
        <span className="toggle-knob" />
      </button>
    </div>
  )
}

export default function MenuPage() {
  const { data: menuData, isLoading } = useQuery<MenuData>({ queryKey: ['menu'], queryFn: menuApi.getMenu })

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)', fontSize: 13 }}>
      Loading menu…
    </div>
  )

  const categories = menuData?.categories ?? []
  const items = menuData?.items ?? []
  const available = items.filter(i => i.is_available).length

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 32 }}>
      <div style={{ padding: '20px 16px 12px' }}>
        <h1 className="font-display" style={{ fontSize: 28, color: 'var(--text)' }}>Menu</h1>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          {available} of {items.length} items available · toggle to hide
        </p>
      </div>

      {categories.map(cat => {
        const catItems = items.filter(i => i.category_id === cat.id)
        if (!catItems.length) return null
        return (
          <div key={cat.id} style={{ marginBottom: 16 }}>
            <div style={{ padding: '8px 16px', background: 'var(--surface-2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
              <p className="section-label">{cat.name}</p>
            </div>
            <div style={{ background: 'var(--surface)' }}>
              {catItems.map(item => <MenuItemRow key={item.id} item={item} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
