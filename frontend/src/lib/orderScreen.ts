import { shownAvailability } from './availabilityWrites'
import { isPlaceholder } from './menuCache'
import { MenuItem, Modifier } from '../types'

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
