import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { menuApi } from '../lib/api'
import { MenuData, MenuItem } from '../types'

function Row({ item }: { item: MenuItem }) {
  const qc = useQueryClient()
  const tog = useMutation({
    mutationFn: () => menuApi.toggleItem(item.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu'] })
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid var(--border)', opacity: item.is_available ? 1 : 0.4, transition: 'opacity 0.2s' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)', marginBottom: 2 }}>{item.name}</p>
        <p className="type-data" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>₱{item.base_price}</p>
      </div>
      <button onClick={() => tog.mutate()} disabled={tog.isPending}
        className={`tog ${item.is_available ? 'tog-on' : 'tog-off'}`} style={{ marginLeft: 12 }}>
        <span className="tog-knob" />
      </button>
    </div>
  )
}

export default function MenuPage() {
  const { data: menuData, isLoading } = useQuery<MenuData>({ queryKey: ['menu'], queryFn: menuApi.getMenu })
  if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--t3)' }}>LOADING···</span></div>

  const cats = menuData?.categories ?? []
  const items = menuData?.items ?? []
  const avail = items.filter(i => i.is_available).length

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 32 }}>
      <div style={{ padding: '16px 16px 12px' }}>
        <h1 className="type-display" style={{ fontSize: 24, color: 'var(--t1)' }}>Menu</h1>
        <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--t3)', marginTop: 4, letterSpacing: '0.04em' }}>
          {avail}/{items.length} ITEMS AVAILABLE
        </p>
      </div>

      {cats.map(cat => {
        const ci = items.filter(i => i.category_id === cat.id)
        if (!ci.length) return null
        return (
          <div key={cat.id} style={{ marginBottom: 12 }}>
            <div style={{ padding: '7px 16px', background: 'var(--s2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
              <p className="type-label">{cat.name}</p>
            </div>
            <div style={{ background: 'var(--s1)' }}>
              {ci.map(item => <Row key={item.id} item={item} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
