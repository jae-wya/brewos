import { describe, it, expect, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { keys } from './queryKeys'
import { putItem, removeItem, putOptimistic, settleItem, nextSortOrder, placeholderId, isPlaceholder } from './menuCache'
import { MenuData, MenuItem } from '../types'

const item = (id: string, category_id: string, sort_order: number, extra: Partial<MenuItem> = {}): MenuItem => ({
  id, business_id: 'biz', category_id, name: id, description: null, base_price: 100,
  image_url: null, is_available: true, sort_order, menu_item_modifiers: [], ...extra,
})

let qc: QueryClient
const items = () => qc.getQueryData<MenuData>(keys.menu)!.items
const byId = (id: string) => items().find(i => i.id === id)

beforeEach(() => {
  qc = new QueryClient()
  qc.setQueryData<MenuData>(keys.menu, {
    categories: [],
    modifiers: [],
    items: [item('latte', 'iced', 1), item('mocha', 'iced', 2), item('fries', 'snacks', 1)],
  })
})

describe('putItem / removeItem', () => {
  it('replaces an item in place', () => {
    putItem(qc, item('latte', 'iced', 1, { base_price: 130 }))
    expect(byId('latte')!.base_price).toBe(130)
    expect(items()).toHaveLength(3)
  })

  it('puts a restored item back in its place, not at the bottom of its category', () => {
    removeItem(qc, 'latte')
    expect(byId('latte')).toBeUndefined()
    putItem(qc, item('latte', 'iced', 1))
    expect(items().filter(i => i.category_id === 'iced').map(i => i.id)).toEqual(['latte', 'mocha'])
  })
})

describe('optimistic edits', () => {
  it('settles with the server\'s item', () => {
    const opt = putOptimistic(qc, { ...byId('latte')!, base_price: 130 })
    expect(byId('latte')!.base_price).toBe(130)
    settleItem(qc, opt, item('latte', 'iced', 1, { base_price: 130, name: 'Latte (server)' }))
    expect(byId('latte')!.name).toBe('Latte (server)')
  })

  it('rolls back to the previous item', () => {
    const before = byId('latte')!
    const opt = putOptimistic(qc, { ...before, base_price: 130 })
    settleItem(qc, opt, before)
    expect(byId('latte')!.base_price).toBe(100)
  })

  // Regression: settleItem used to compare object identity, but setQueryData
  // structurally shares data and stores a copy, so no rollback ever matched.
  it('settles even though the cache holds a copy, not the object passed in', () => {
    const before = byId('latte')!
    const opt = putOptimistic(qc, { ...before, base_price: 130 })
    expect(byId('latte')).not.toBe(opt)
    settleItem(qc, opt, before)
    expect(byId('latte')!.base_price).toBe(100)
  })

  it('a slow answer for an older edit doesn\'t undo a newer one', () => {
    const before = byId('latte')!
    const first = putOptimistic(qc, { ...before, base_price: 130 })
    const second = putOptimistic(qc, { ...before, base_price: 140 })
    settleItem(qc, first, before)          // first edit failed: but the second owns the item now
    expect(byId('latte')!.base_price).toBe(140)
    settleItem(qc, second, item('latte', 'iced', 1, { base_price: 140 }))
    expect(byId('latte')!.base_price).toBe(140)
  })

  it('a new item\'s placeholder is replaced by the real item', () => {
    const opt = putOptimistic(qc, item(placeholderId(), 'iced', nextSortOrder(qc, 'iced')))
    expect(isPlaceholder(opt)).toBe(true)
    expect(items().filter(isPlaceholder)).toHaveLength(1)
    settleItem(qc, opt, item('new-real-id', 'iced', 3))
    expect(items().filter(isPlaceholder)).toHaveLength(0)
    expect(byId('new-real-id')).toBeDefined()
  })

  it('a failed new item is removed', () => {
    const opt = putOptimistic(qc, item(placeholderId(), 'iced', 3))
    settleItem(qc, opt, null)
    expect(items().filter(isPlaceholder)).toHaveLength(0)
    expect(items()).toHaveLength(3)
  })
})

describe('nextSortOrder', () => {
  it('is one past the last item in that category', () => {
    expect(nextSortOrder(qc, 'iced')).toBe(3)
    expect(nextSortOrder(qc, 'snacks')).toBe(2)
  })
  it('is 1 for an empty category', () => {
    expect(nextSortOrder(qc, 'pastries')).toBe(1)
  })
})
