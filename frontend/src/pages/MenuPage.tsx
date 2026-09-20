import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { menuApi } from '../lib/api'
import { MenuData, MenuItem } from '../types'

function MenuItemRow({ item, idx }: { item: MenuItem, idx: number }) {
  const qc = useQueryClient()
  const tog = useMutation({
    mutationFn: () => menuApi.toggleItem(item.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu'] })
  })

  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '12px 16px',
      borderBottom: '1px solid var(--border)',
      opacity: item.is_available ? 1 : 0.4,
      transition: 'opacity 0.2s',
      animation: `childEnter 0.3s ${idx * 20}ms both`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 3 }}>{item.name}</p>
        <p className="data" style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>₱{item.base_price}</p>
      </div>
      <button onClick={() => tog.mutate()} disabled={tog.isPending}
        role="switch" aria-checked={item.is_available}
        aria-label={`${item.is_available ? 'Disable' : 'Enable'} ${item.name}`}
        className={`tog ${item.is_available ? 'tog-on' : 'tog-off'}`}
        style={{ marginLeft: 16 }}>
        <span className="tog-knob" />
      </button>
    </div>
  )
}

export default function MenuPage() {
  const { data: menuData, isLoading } = useQuery<MenuData>({ queryKey: ['menu'], queryFn: menuApi.getMenu })

  if (isLoading) return (
    <div style={{ padding: 16 }}>
      {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8 }} />)}
    </div>
  )

  const cats = menuData?.categories ?? []
  const items = menuData?.items ?? []
  const avail = items.filter(i => i.is_available).length

  return (
    <div className="page-enter" style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 32 }}>
      <div style={{ padding: '16px 16px 14px' }}>
        <h1 className="display" style={{ fontSize: 40, color: 'var(--t1)', lineHeight: 0.95 }}>MENU</h1>
        <p role="status" style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: 'var(--t3)', marginTop: 8, letterSpacing: '0.06em' }}>
          {avail}/{items.length} ITEMS AVAILABLE
        </p>
      </div>

      {cats.map(cat => {
        const ci = items.filter(i => i.category_id === cat.id)
        if (!ci.length) return null
        return (
          <section key={cat.id} aria-label={cat.name} style={{ marginBottom: 12 }}>
            <div style={{ padding: '8px 16px', background: 'var(--s2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
              <p className="label">{cat.name}</p>
            </div>
            <div style={{ background: 'var(--s1)' }}>
              {ci.map((item, idx) => <MenuItemRow key={item.id} item={item} idx={idx} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}
