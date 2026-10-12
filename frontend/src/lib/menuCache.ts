import { QueryClient } from '@tanstack/react-query'
import { keys } from './queryKeys'
import { MenuData, MenuItem } from '../types'

// Edits to the cached menu (one cache, both screens; see keys.menu).
//
// Every Menu page save is optimistic: the change goes into the cache on tap
// (putOptimistic), the request runs in the background, and the cache is
// settled with the server's answer, or put back, when it returns. Settling is
// guarded: if a newer edit has replaced that item in the cache since, the
// older answer is dropped, so a slow response can't undo something she did
// after it.
//
// The guard compares an edit number stored on the item, not the object:
// setQueryData structurally shares data and stores a COPY of any changed
// object, so the object we put in is never the one in the cache.

// Server order is by sort_order (per category, so pages filter by category
// first). Keeping that order means a restored or moved item lands where the
// server will put it, not appended to the bottom of its category.
const bySortOrder = (items: MenuItem[]) => [...items].sort((a, b) => a.sort_order - b.sort_order)

function setItems(qc: QueryClient, update: (items: MenuItem[]) => MenuItem[]) {
  // Drop any fetch in flight: it started before this change and would
  // overwrite it with what the server had then.
  qc.cancelQueries({ queryKey: keys.menu })
  qc.setQueryData<MenuData>(keys.menu, d => d && { ...d, items: update(d.items) })
}

// Replace the item if it's there, otherwise add it (a new or restored item).
export function putItem(qc: QueryClient, item: MenuItem) {
  setItems(qc, items => bySortOrder(
    items.some(i => i.id === item.id) ? items.map(i => i.id === item.id ? item : i) : [...items, item]))
}

export function removeItem(qc: QueryClient, itemId: string) {
  setItems(qc, items => items.filter(i => i.id !== itemId))
}

// Cache-only marker; never sent to the server.
type Optimistic = MenuItem & { _edit: number }
let edits = 0

// Put an edit on screen before the server has it. Pass the returned value
// to settleItem when the request returns.
export function putOptimistic(qc: QueryClient, item: MenuItem): Optimistic {
  const tagged = { ...item, _edit: ++edits }
  putItem(qc, tagged)
  return tagged
}

// When the request for `optimistic` returns: write `result` (the server's
// item, or the previous one to roll back, or null to remove it), but only if
// that edit is still the one in the cache.
export function settleItem(qc: QueryClient, optimistic: Optimistic, result: MenuItem | null) {
  setItems(qc, items => {
    const mine = (i: MenuItem) => i.id === optimistic.id && (i as Optimistic)._edit === optimistic._edit
    if (!items.some(mine)) return items // a newer edit owns this item now
    const rest = items.filter(i => !mine(i))
    return result ? bySortOrder([...rest, result]) : rest
  })
}

// Where the server will put an item added or moved into this category.
export function nextSortOrder(qc: QueryClient, categoryId: string): number {
  const items = qc.getQueryData<MenuData>(keys.menu)?.items ?? []
  return Math.max(0, ...items.filter(i => i.category_id === categoryId).map(i => i.sort_order)) + 1
}

// A new item between tap and server reply has a placeholder id. Nothing may
// send that id to the server: the row is inert and the order screen hides it.
let placeholders = 0
export const placeholderId = () => `pending-${++placeholders}`
export const isPlaceholder = (item: MenuItem) => item.id.startsWith('pending-')
