import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { offeredItems, offeredModifiers } from './orderScreen'
import { setAvailability } from './availabilityWrites'
import { MenuItem, Modifier } from '../types'

const item = (id: string, category_id: string, extra: Partial<MenuItem> = {}): MenuItem => ({
  id, business_id: 'biz', category_id, name: id, description: null, base_price: 100,
  image_url: null, is_available: true, sort_order: 1, menu_item_modifiers: [], ...extra,
})

// A toggle she has tapped whose save hasn't finished. Fake timers are never
// advanced, so the write stays pending for the whole test.
const pendingTap = (kind: 'item' | 'option', id: string, from: boolean) =>
  setAvailability(`${kind}:${id}`, from, !from, { send: () => new Promise(() => {}), show: () => {}, onFailed: () => {} })

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('offeredItems', () => {
  const menu = [
    item('latte', 'iced'),
    item('mocha', 'iced', { is_available: false }),
    item('pending-1', 'iced'),            // new item, no real id yet
    item('fries', 'snacks'),
  ]

  it('offers items that are on, in the chosen category', () => {
    expect(offeredItems(menu, 'iced').map(i => i.id)).toEqual(['latte'])
    expect(offeredItems(menu, 'snacks').map(i => i.id)).toEqual(['fries'])
  })

  it('never offers a turned-off item', () => {
    expect(offeredItems(menu, 'iced').map(i => i.id)).not.toContain('mocha')
  })

  it('never offers a new item that has no real id yet', () => {
    expect(offeredItems(menu, 'iced').map(i => i.id)).not.toContain('pending-1')
  })

  it('a switch still saving wins over the cached value, both ways', () => {
    const items = [item('os-latte', 'iced'), item('os-mocha', 'iced', { is_available: false })]
    pendingTap('item', 'os-latte', true)    // turned off, cache still says on
    pendingTap('item', 'os-mocha', false)   // turned on, cache still says off
    expect(offeredItems(items, 'iced').map(i => i.id)).toEqual(['os-mocha'])
  })

  it('offers nothing before categories load', () => {
    expect(offeredItems(menu, undefined)).toEqual([])
  })
})

describe('offeredModifiers', () => {
  const size: Modifier = {
    id: 'size', name: 'Size', is_required: true, modifier_options: [
      { id: 'm', modifier_id: 'size', name: 'Medium (M)', price_delta: 0, sort_order: 1, is_available: true },
      { id: 'l', modifier_id: 'size', name: 'Large (L)', price_delta: 15, sort_order: 2, is_available: false },
    ],
  }
  const addons: Modifier = {
    id: 'addons', name: 'Coffee Add-Ons', is_required: false, modifier_options: [
      { id: 'os-shot', modifier_id: 'addons', name: 'Espresso Shot', price_delta: 30, sort_order: 1, is_available: true },
    ],
  }
  const sauces: Modifier = { id: 'sides', name: 'Sides', is_required: false, modifier_options: [] }
  const latte = item('latte', 'iced', { menu_item_modifiers: [{ modifier_id: 'size' }, { modifier_id: 'addons' }] })

  it('only the item\'s own groups', () => {
    expect(offeredModifiers(latte, [size, addons, sauces]).map(m => m.id)).toEqual(['size', 'addons'])
  })

  it('never offers a turned-off add-on', () => {
    const [s] = offeredModifiers(latte, [size])
    expect(s.modifier_options.map(o => o.id)).toEqual(['m'])
  })

  it('an add-on switched off and still saving is not offered', () => {
    pendingTap('option', 'os-shot', true)
    const [, a] = offeredModifiers(latte, [size, addons])
    expect(a.modifier_options).toEqual([])
  })

  it('leaves the shared menu untouched', () => {
    offeredModifiers(latte, [size])
    expect(size.modifier_options).toHaveLength(2)
  })
})
