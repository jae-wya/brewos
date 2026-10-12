import { QueryClient } from '@tanstack/react-query'
import { keys } from './queryKeys'
import { MenuData, MenuItem } from '../types'

// Edits to the Menu page's cached data, so a save shows at once instead of
// waiting for the reload that follows it (refreshMenus).

// Replace the item if it's there, otherwise add it (a new or restored item).
export function putItem(qc: QueryClient, item: MenuItem) {
  qc.cancelQueries({ queryKey: keys.menuFull })
  qc.setQueryData<MenuData>(keys.menuFull, d => d && {
    ...d,
    items: d.items.some(i => i.id === item.id)
      ? d.items.map(i => i.id === item.id ? item : i)
      : [...d.items, item],
  })
}

export function removeItem(qc: QueryClient, itemId: string) {
  qc.cancelQueries({ queryKey: keys.menuFull })
  qc.setQueryData<MenuData>(keys.menuFull, d => d && { ...d, items: d.items.filter(i => i.id !== itemId) })
}
