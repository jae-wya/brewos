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
    <div className="flex items-center justify-between px-4 py-3"
      style={{
        borderBottom: '1px solid var(--border)',
        opacity: item.is_available ? 1 : 0.45,
      }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
          {item.name}
        </p>
        <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--accent)' }}>
          ₱{item.base_price}
        </p>
      </div>
      <button
        onClick={() => toggle.mutate()}
        disabled={toggle.isPending}
        className={`toggle ${item.is_available ? 'toggle-on' : 'toggle-off'} ml-3`}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  )
}

export default function MenuPage() {
  const { data: menuData, isLoading } = useQuery<MenuData>({
    queryKey: ['menu'],
    queryFn: menuApi.getMenu,
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>
      Loading menu…
    </div>
  )

  const categories = menuData?.categories ?? []
  const items = menuData?.items ?? []
  const availableCount = items.filter(i => i.is_available).length

  return (
    <div className="max-w-lg mx-auto pb-8">
      <div className="px-4 pt-4 pb-3">
        <h1 className="font-display text-2xl" style={{ color: 'var(--text)' }}>Menu</h1>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {availableCount} of {items.length} items available · toggle to hide from orders
        </p>
      </div>

      {categories.map(cat => {
        const catItems = items.filter(i => i.category_id === cat.id)
        if (catItems.length === 0) return null
        return (
          <div key={cat.id} className="mb-4">
            <div className="px-4 py-2"
              style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                {cat.name}
              </p>
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
