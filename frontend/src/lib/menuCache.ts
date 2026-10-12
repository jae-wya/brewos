import { QueryClient } from '@tanstack/react-query'
import { keys } from './queryKeys'
import { MenuData, MenuItem } from '../types'

// Edits to the cached menus, so a save shows at once instead of waiting for
// the reload that follows it (refreshMenus).
//
// Both caches, not just the Menu page's: invalidating the order screen's menu
// only marks it stale, and React Query shows stale data while it refetches —
// so she'd see the old price for a full round trip to Render. Items have the
// same shape in both (the order screen filters unavailable ones itself).
const MENUS = [keys.menuFull, keys.menu]

// Replace the item if it's there, otherwise add it (a new or restored item).
export function putItem(qc: QueryClient, item: MenuItem) {
  for (const key of MENUS) {
    qc.cancelQueries({ queryKey: key })
    qc.setQueryData<MenuData>(key, d => d && {
      ...d,
      items: d.items.some(i => i.id === item.id)
        ? d.items.map(i => i.id === item.id ? item : i)
        : [...d.items, item],
    })
  }
}

export function removeItem(qc: QueryClient, itemId: string) {
  for (const key of MENUS) {
    qc.cancelQueries({ queryKey: key })
    qc.setQueryData<MenuData>(key, d => d && { ...d, items: d.items.filter(i => i.id !== itemId) })
  }
}
