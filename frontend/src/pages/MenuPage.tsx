import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { menuApi } from '../lib/api'
import { MenuData, MenuItem } from '../types'
import clsx from 'clsx'

function MenuItemRow({ item, categoryName }: { item: MenuItem, categoryName: string }) {
  const qc = useQueryClient()
  const toggle = useMutation({
    mutationFn: () => menuApi.toggleItem(item.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu'] })
  })

  return (
    <div className={clsx(
      'flex items-center justify-between px-4 py-3 border-b border-roast-700',
      !item.is_available && 'opacity-50'
    )}>
      <div className="flex-1">
        <p className="text-sm text-brew-100 font-medium">{item.name}</p>
        <p className="text-xs text-roast-400">₱{item.base_price}</p>
      </div>
      <button
        onClick={() => toggle.mutate()}
        disabled={toggle.isPending}
        className={clsx(
          'relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0',
          item.is_available ? 'bg-brew-500' : 'bg-roast-600'
        )}
      >
        <span className={clsx(
          'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
          item.is_available ? 'translate-x-5' : 'translate-x-0.5'
        )} />
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
    <div className="flex items-center justify-center h-64 text-roast-500">
      Loading menu...
    </div>
  )

  const categories = menuData?.categories ?? []
  const items = menuData?.items ?? []

  return (
    <div className="max-w-lg mx-auto pb-8">
      <div className="px-4 py-4">
        <h1 className="font-display text-xl font-bold text-brew-100">Menu Management</h1>
        <p className="text-roast-400 text-xs mt-1">Toggle items on/off without deleting them</p>
      </div>

      {categories.map(cat => {
        const catItems = items.filter(i => i.category_id === cat.id)
        if (catItems.length === 0) return null
        return (
          <div key={cat.id} className="mb-4">
            <div className="px-4 py-2 bg-roast-700 border-y border-roast-600">
              <p className="text-xs font-semibold text-brew-400 uppercase tracking-wider">
                {cat.name}
              </p>
            </div>
            <div className="bg-roast-800">
              {catItems.map(item => (
                <MenuItemRow
                  key={item.id}
                  item={item}
                  categoryName={cat.name}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
