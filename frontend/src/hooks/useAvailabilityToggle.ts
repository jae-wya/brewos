import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { menuApi, errorMessage } from '../lib/api'
import { keys } from '../lib/queryKeys'
import { setAvailability, pendingAvailability } from '../lib/availabilityWrites'
import { MenuData } from '../types'

type Kind = 'item' | 'option'

// Write one item's or option's availability into the cached Menu page data.
// An option is stored once under its modifier group, so every row that shows
// it (e.g. "Large" under thirty drinks) updates together.
function withAvailability(data: MenuData, kind: Kind, id: string, value: boolean): MenuData {
  if (kind === 'item') {
    return { ...data, items: data.items.map(i => i.id === id ? { ...i, is_available: value } : i) }
  }
  return {
    ...data,
    modifiers: data.modifiers.map(m => ({
      ...m,
      modifier_options: m.modifier_options.map(o => o.id === id ? { ...o, is_available: value } : o),
    })),
  }
}

// The same change in the order screen's menu. That menu comes from the server
// without turned-off add-ons (items it filters itself), so an add-on is
// removed when turned off, and copied back from the Menu page's data, which
// has every option, when turned on. Run after the Menu page write.
function withOrderScreenAvailability(data: MenuData, full: MenuData | undefined, kind: Kind, id: string, value: boolean): MenuData {
  if (kind === 'item') return withAvailability(data, kind, id, value)
  return {
    ...data,
    modifiers: data.modifiers.map(m => {
      const without = m.modifier_options.filter(o => o.id !== id)
      if (!value) return { ...m, modifier_options: without }
      const option = full?.modifiers.find(f => f.id === m.id)?.modifier_options.find(o => o.id === id)
      if (!option) return m // not in this group
      return { ...m, modifier_options: [...without, option].sort((a, b) => a.sort_order - b.sort_order) }
    }),
  }
}

// On/off switch on the Menu page. Timing, ordering and rollback live in
// lib/availabilityWrites.ts; this hook connects them to the cache and the API.
//   * The Menu page is never refetched for a toggle, so a slow refetch can't
//     flash old values over a switch she just flipped.
//   * Every tap (and any rollback) is written into the order screen's menu
//     too, so a turned-off item or add-on stops being offered at once rather
//     than after a refetch. Invalidation after the save is the backstop.
//   * On failure, returns an error for the row to show.
export function useAvailabilityToggle(kind: Kind, id: string, name: string) {
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const key = `${kind}:${id}`

  const set = (shown: boolean, next: boolean) => {
    setError(null)
    setAvailability(key, shown, next, {
      send: v => (kind === 'item' ? menuApi.setItemAvailable(id, v) : menuApi.setOptionAvailable(id, v))
        .then(res => res.is_available),
      show: v => {
        qc.cancelQueries({ queryKey: keys.menuFull })
        qc.cancelQueries({ queryKey: keys.menu })
        qc.setQueryData<MenuData>(keys.menuFull, d => d && withAvailability(d, kind, id, v))
        const full = qc.getQueryData<MenuData>(keys.menuFull)
        qc.setQueryData<MenuData>(keys.menu, d => d && withOrderScreenAvailability(d, full, kind, id, v))
      },
      onSaved: () => qc.invalidateQueries({ queryKey: keys.menu }),
      onFailed: (v, err) => setError(`Couldn't turn ${v ? 'on' : 'off'} ${name}. ${errorMessage(err)}`),
    })
  }

  // The value to show: her pending tap if there is one, else the cached value.
  const on = (cached: boolean) => pendingAvailability(key) ?? cached

  return { set, on, error }
}
