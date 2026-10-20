import { shownAvailability } from './availabilityWrites'
import { isPlaceholder } from './menuCache'
import { peso } from './composer'
import { CartItem, MenuItem, Modifier, Size } from '../types'

// What the order screen offers from the shared menu (keys.menu), which holds
// everything — turned-off items and add-ons included, because the Menu page
// reads the same cache. Kept here, not inline in NewOrderPage, so it can be
// tested: getting it wrong sells something she can't make.

// Items in a category she can order now: on (or switched on and still
// saving), and not a new item still waiting for its real id — an order can't
// reference a placeholder.
export function offeredItems(items: MenuItem[], categoryId: string | undefined): MenuItem[] {
  return items.filter(i => i.category_id === categoryId && !isPlaceholder(i)
    && shownAvailability('item', i.id, i.is_available))
}

// An item's add-on groups with only the options that are on.
export function offeredModifiers(item: MenuItem, modifiers: Modifier[]): Modifier[] {
  const linked = item.menu_item_modifiers.map(m => m.modifier_id)
  return modifiers.filter(m => linked.includes(m.id)).map(m => ({
    ...m, modifier_options: m.modifier_options.filter(o => shownAvailability('option', o.id, o.is_available)),
  }))
}

// The names the server snapshots for a size (backend orders.py, size_row), so
// the cart, the chit and the payment message read like the queue.
export const SIZE_NAMES: Record<Size, string> = { M: 'Medium (M)', L: 'Large (L)' }

// What a Large adds to the Medium. For display: the server prices it.
export function largeExtra(item: MenuItem): number {
  return item.large_price == null ? 0 : Math.round((item.large_price - item.base_price) * 100) / 100
}

// A cart line's size and add-ons, size first, as they'll print.
export function cartOptionNames(line: CartItem): string[] {
  return [...(line.size ? [SIZE_NAMES[line.size]] : []), ...line.modifiers.map(m => m.option_name)]
}

// "₱135 / 160" for an item with a Large, "₱130" for one size: the way her
// printed menu lists them. The Medium-only price would be wrong half the time.
export function priceLabel(item: MenuItem): string {
  return item.large_price == null ? peso(item.base_price) : `${peso(item.base_price)} / ${peso(item.large_price).slice(1)}`
}
